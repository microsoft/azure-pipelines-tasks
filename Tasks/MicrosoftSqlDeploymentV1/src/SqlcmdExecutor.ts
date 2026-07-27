import tl = require('azure-pipelines-task-lib/task');
import SqlConnectionConfig from './SqlConnectionConfig';
import Constants from './Constants';

export class SqlcmdExecutor {
    /**
     * Execute a .sql script file using sqlcmd.
     * Password and access token are passed via environment variables — never on the command line.
     */
    public static async executeSqlcmd(
        sqlcmdPath: string,
        scriptPath: string,
        connectionConfig: SqlConnectionConfig,
        additionalArguments?: string,
        accessToken?: string
    ): Promise<void> {
        const args = this.buildArguments(scriptPath, connectionConfig, additionalArguments);

        // Pass credentials via environment variables only — never on the command line.
        // Scoped to this exec call only (not set on process.env globally).
        const envVars: { [key: string]: string } = Object.assign({}, process.env);

        if (accessToken) {
            // AAD token-based auth: use SQLCMDACCESSTOKEN, do not set password
            envVars['SQLCMDACCESSTOKEN'] = accessToken;
        } else if (connectionConfig.Password) {
            // SQL / AAD password auth: pass password via SQLCMDPASSWORD env var
            envVars[Constants.sqlcmdPasswordEnvVarName] = connectionConfig.Password;
        }

        tl.debug(`Executing sqlcmd: ${sqlcmdPath}`);

        const result = await tl.exec(sqlcmdPath, args, {
            env: envVars,
            failOnStdErr: false,
            ignoreReturnCode: true
        });

        if (result !== 0) {
            throw new Error(tl.loc('SqlcmdExecutionFailed', result));
        }
    }

    /**
     * Build sqlcmd command line arguments.
     * Per spec: UTF-8 encoding is preserved by default with go-sqlcmd.
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
        const authType = (connectionConfig.FormattedAuthentication ?? '').toLowerCase();
        if (authType.includes('activedirectory') || authType === '') {
            if (connectionConfig.UserId) {
                args.push('-U');
                args.push(connectionConfig.UserId);
                // Password passed via SQLCMDPASSWORD env var
            } else {
                // AAD Default / Integrated — no credentials needed
                args.push('-G');
            }
        } else {
            // SQL auth
            args.push('-U');
            args.push(connectionConfig.UserId!);
            // Password passed via SQLCMDPASSWORD env var
        }

        // Login timeout (30s)
        args.push('-l');
        args.push('30');

        // Input file
        args.push('-i');
        args.push(scriptPath);

        // Additional arguments
        if (additionalArguments) {
            args.push(...this.parseAdditionalArguments(additionalArguments));
        }

        return args;
    }

    /**
     * Parse additional arguments respecting quoted values.
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
