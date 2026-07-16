import tl = require('azure-pipelines-task-lib/task');
import SqlConnectionConfig from './SqlConnectionConfig';

export class SqlPackageExecutor {
    /**
     * Execute SqlPackage with the specified parameters
     * @param sqlPackagePath Path to SqlPackage executable
     * @param action SqlPackage action (Publish, Script, DeployReport)
     * @param sourcePath Path to .dacpac file
     * @param connectionConfig SQL connection configuration
     * @param publishProfile Optional path to publish profile
     * @param additionalArguments Optional additional arguments
     * @returns Output file path if /OutputPath was specified
     */
    public static async executeSqlPackage(
        sqlPackagePath: string,
        action: string,
        sourcePath: string,
        connectionConfig: SqlConnectionConfig,
        publishProfile?: string,
        additionalArguments?: string
    ): Promise<string | undefined> {
        const args = this.buildArguments(action, sourcePath, connectionConfig, publishProfile, additionalArguments);
        
        tl.debug(`Executing SqlPackage: ${sqlPackagePath} ${args.join(' ')}`);
        
        const result = await tl.exec(sqlPackagePath, args, {
            failOnStdErr: false,
            ignoreReturnCode: false
        });
        
        if (result !== 0) {
            throw new Error(tl.loc('SqlPackageExecutionFailed', result));
        }
        
        // Extract output file path if /OutputPath was specified
        return this.extractOutputPath(additionalArguments);
    }

    /**
     * Build SqlPackage command line arguments
     */
    private static buildArguments(
        action: string,
        sourcePath: string,
        connectionConfig: SqlConnectionConfig,
        publishProfile?: string,
        additionalArguments?: string
    ): string[] {
        const args: string[] = [];
        
        // Action parameter
        args.push(`/Action:${this.mapActionToSqlPackageAction(action)}`);
        
        // Source file
        args.push(`/SourceFile:${sourcePath}`);
        
        // Target connection string (escaped for command line)
        args.push(`/TargetConnectionString:${connectionConfig.EscapedConnectionString}`);
        
        // Publish profile (optional)
        if (publishProfile) {
            tl.checkPath(publishProfile, 'publishProfile');
            args.push(`/Profile:${publishProfile}`);
        }
        
        // Additional arguments (optional)
        if (additionalArguments) {
            // Split additional arguments respecting quotes
            const additionalArgs = this.parseAdditionalArguments(additionalArguments);
            args.push(...additionalArgs);
        }
        
        return args;
    }

    /**
     * Map Azure DevOps task action to SqlPackage action
     */
    private static mapActionToSqlPackageAction(action: string): string {
        switch (action.toLowerCase()) {
            case 'publish':
                return 'Publish';
            case 'script':
                return 'Script';
            case 'deployreport':
                return 'DeployReport';
            default:
                throw new Error(tl.loc('InvalidAction', action));
        }
    }

    /**
     * Parse additional arguments respecting quotes
     */
    private static parseAdditionalArguments(additionalArguments: string): string[] {
        const args: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < additionalArguments.length; i++) {
            const char = additionalArguments[i];
            
            if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
                current += char;
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
                current += char;
            } else if (char === ' ' && !inQuotes) {
                if (current.trim()) {
                    args.push(current.trim());
                    current = '';
                }
            } else {
                current += char;
            }
        }
        
        if (current.trim()) {
            args.push(current.trim());
        }
        
        return args;
    }

    /**
     * Extract output file path from additional arguments if /OutputPath was specified
     */
    private static extractOutputPath(additionalArguments?: string): string | undefined {
        if (!additionalArguments) {
            return undefined;
        }
        
        const outputPathRegex = /\/OutputPath[:\s]+"?([^"\s]+)"?/i;
        const match = additionalArguments.match(outputPathRegex);
        
        if (match && match[1]) {
            return match[1];
        }
        
        return undefined;
    }
}
