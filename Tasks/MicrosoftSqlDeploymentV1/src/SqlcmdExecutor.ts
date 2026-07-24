import tl = require('azure-pipelines-task-lib/task');
import SqlConnectionConfig from './SqlConnectionConfig';

export class SqlcmdExecutor {
    /**
     * Execute sqlcmd with the specified SQL script
     */
    public static async executeSqlcmd(
        sqlcmdPath: string,
        scriptPath: string,
        connectionConfig: SqlConnectionConfig,
        additionalArguments?: string,
        accessToken?: string
    ): Promise<void> {
        const args = this.buildArguments(scriptPath, connectionConfig, additionalArguments);

        // Password and access token are passed via environment variables, never on the command line
        const envVars: { [key: string]: string } = {};
        if (connectionConfig.Password) {
            envVars['SQLCMDPASSWORD'] = connectionConfig.Password;
        }
        if (accessToken) {
            envVars['SQLCMDACCESSTOKEN'] = accessToken;
        }

        tl.debug(`Executing sqlcmd: ${sqlcmdPath}`);

        const result = await tl.exec(sqlcmdPath, args, {
            env: { ...process.env, ...envVars },
            failOnStdErr: false,
            ignoreReturnCode: true
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

        // Server (with port if specified)
        args.push('-S');
        args.push(connectionConfig.Port
            ? `${connectionConfig.Server},${connectionConfig.Port}`
            : connectionConfig.Server);

        // Database
        if (connectionConfig.Database) {
            args.push('-d');
            args.push(connectionConfig.Database);
        }

        // Authentication
        if (connectionConfig.UserId) {
            // SQL/AAD password auth — password via SQLCMDPASSWORD env var
            args.push('-U');
            args.push(connectionConfig.UserId);
        } else {
            const authType = connectionConfig.FormattedAuthentication;
            if (authType && authType.toLowerCase().includes('activedirectory')) {
                args.push('-G');  // Azure Active Directory authentication
            } else {
                args.push('-E');  // Windows integrated authentication
            }
        }

        // Login timeout
        args.push('-l');
        args.push('30');

        // Input file
        args.push('-i');
        args.push(scriptPath);

        if (additionalArguments) {
            args.push(...this.parseAdditionalArguments(additionalArguments));
        }

        return args;
    }

    /**
     * Parse additional arguments respecting quoted values
     */
    private static parseAdditionalArguments(additionalArguments: string): string[] {
        const args: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (const char of additionalArguments) {
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
