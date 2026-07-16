import tl = require('azure-pipelines-task-lib/task');
import SqlConnectionConfig from './SqlConnectionConfig';

export class SqlcmdExecutor {
    /**
     * Execute sqlcmd with the specified SQL script
     * @param sqlcmdPath Path to sqlcmd executable
     * @param scriptPath Path to .sql file
     * @param connectionConfig SQL connection configuration
     * @param additionalArguments Optional additional arguments
     */
    public static async executeSqlcmd(
        sqlcmdPath: string,
        scriptPath: string,
        connectionConfig: SqlConnectionConfig,
        additionalArguments?: string
    ): Promise<void> {
        const args = this.buildArguments(scriptPath, connectionConfig, additionalArguments);
        
        // Set password as environment variable (more secure than command line)
        const envVars: { [key: string]: string } = {};
        if (connectionConfig.Password) {
            envVars['SQLCMDPASSWORD'] = connectionConfig.Password;
        }
        
        tl.debug(`Executing sqlcmd: ${sqlcmdPath} ${args.join(' ')}`);
        tl.debug(`SQL script: ${scriptPath}`);
        
        const result = await tl.exec(sqlcmdPath, args, {
            env: { ...process.env, ...envVars },
            failOnStdErr: false,
            ignoreReturnCode: false
        });
        
        if (result !== 0) {
            throw new Error(tl.loc('SqlcmdExecutionFailed', result));
        }
    }

    /**
     * Build sqlcmd command line arguments
     */
    private static buildArguments(
        scriptPath: string,
        connectionConfig: SqlConnectionConfig,
        additionalArguments?: string
    ): string[] {
        const args: string[] = [];
        
        // Server
        args.push('-S');
        args.push(connectionConfig.Server);
        
        // Database (if specified)
        if (connectionConfig.Database) {
            args.push('-d');
            args.push(connectionConfig.Database);
        }
        
        // Authentication
        if (connectionConfig.UserId) {
            // SQL authentication
            args.push('-U');
            args.push(connectionConfig.UserId);
            // Password is set via environment variable SQLCMDPASSWORD
        } else {
            // Integrated/Windows authentication or Azure AD
            const authType = connectionConfig.FormattedAuthentication;
            if (authType && authType.toLowerCase().includes('active directory')) {
                args.push('-G');  // Azure Active Directory authentication
            } else {
                args.push('-E');  // Windows integrated authentication
            }
        }
        
        // Input file
        args.push('-i');
        args.push(scriptPath);
        
        // Additional arguments (optional)
        if (additionalArguments) {
            // Split additional arguments respecting quotes
            const additionalArgs = this.parseAdditionalArguments(additionalArguments);
            args.push(...additionalArgs);
        }
        
        return args;
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
}
