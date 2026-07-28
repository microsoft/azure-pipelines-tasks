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
        envOverrides?: { [key: string]: string }
    ): Promise<void> {
        const args = this.buildArguments(scriptPath, connectionConfig, additionalArguments, envOverrides?.['AZURE_TENANT_ID']);

        // Pass credentials via environment variables only — never on the command line.
        // Scoped to this exec call only (not set on process.env globally).
        const envVars: { [key: string]: string } = Object.assign({}, process.env, envOverrides);

        if (connectionConfig.Password) {
            // Pass password via SQLCMDPASSWORD env var — never on the command line.
            // go-sqlcmd reads SQLCMDPASSWORD automatically for SQL auth and AAD password/SP auth.
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
        additionalArguments?: string,
        tenantId?: string
    ): string[] {
        const args: string[] = [];

        // Server (with port if specified)
        args.push('-S');
        args.push(
            connectionConfig.Port
                ? `${connectionConfig.Server},${connectionConfig.Port}`
                : connectionConfig.Server
        );

        // Database
        if (connectionConfig.Database) {
            args.push('-d');
            args.push(connectionConfig.Database);
        }

        const authType = (connectionConfig.FormattedAuthentication ?? '').toLowerCase();

        const addAuthenticationMethod = (method: string): void => {
            args.push('--authentication-method');
            args.push(method);
        };

        const addUser = (): void => {
            if (connectionConfig.UserId) {
                args.push('-U');
                args.push(connectionConfig.UserId);
            }
        };

        switch (authType) {
            case 'activedirectorydefault':
                addAuthenticationMethod('ActiveDirectoryDefault');
                break;

            case 'activedirectoryintegrated':
                addAuthenticationMethod('ActiveDirectoryIntegrated');
                break;

            case 'activedirectorypassword':
                // UserId required; password supplied via SQLCMDPASSWORD env var
                addAuthenticationMethod('ActiveDirectoryPassword');
                addUser();
                break;

            case 'activedirectoryserviceprincipal':
                // UserId = ClientId; ClientSecret via SQLCMDPASSWORD env var.
                // go-mssqldb reads the tenant from clientId@tenantId in the User ID field.
                // When azureSubscription is set, AZURE_TENANT_ID is injected and appended here
                addAuthenticationMethod('ActiveDirectoryServicePrincipal');
                if (connectionConfig.UserId && tenantId && !connectionConfig.UserId.includes('@')) {
                    args.push('-U');
                    args.push(`${connectionConfig.UserId}@${tenantId}`);
                } else {
                    addUser();
                }
                break;

            case 'activedirectorymanagedidentity':
                // Optional UserId for user-assigned managed identity
                addAuthenticationMethod('ActiveDirectoryManagedIdentity');
                addUser();
                break;

            default:
                // SQL Authentication — UserId required, password via SQLCMDPASSWORD
                addUser();
                break;
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
