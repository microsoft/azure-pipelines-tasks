import tl = require('azure-pipelines-task-lib/task');
import SqlConnectionConfig from './SqlConnectionConfig';
import Constants from './Constants';

/**
 * Identity material derived from the Azure service connection, used to make go-sqlcmd
 * authenticate as the service connection rather than the agent's ambient identity.
 * Empty when no azureSubscription is configured.
 */
export interface SqlcmdCredentials {
    /** Service connection tenant ID; used to build clientId@tenantId for AAD SP auth. */
    tenantId?: string;
    /** Replaces the --authentication-method value (ActiveDirectoryAzurePipelines for WIF). */
    authMethodOverride?: string;
    /** Environment variables that carry the service connection identity to azidentity. */
    envOverrides?: { [key: string]: string };
}

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
        credentials?: SqlcmdCredentials
    ): Promise<void> {
        const args = this.buildConnectionArguments(connectionConfig, credentials, 30);

        // Abort and return a non-zero exit code when a statement fails. Without -b,
        // go-sqlcmd prints the error but still exits 0, so a half-applied migration would
        // be reported as a successful deployment. Only severity >= 11 aborts, so PRINT
        // output and informational messages are unaffected.
        // Skipped when the user states their own intent in additionalArguments, which also
        // provides the opt-out: additionalArguments: '--exit-on-error=false'.
        if (!this.specifiesErrorHandling(additionalArguments)) {
            args.push('-b');
        }

        // Input file
        args.push('-i');
        args.push(scriptPath);

        if (additionalArguments) {
            args.push(...this.parseAdditionalArguments(additionalArguments));
        }

        const envVars = this.buildEnvironment(connectionConfig, credentials);

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
     * Build the environment for a sqlcmd invocation. Secrets are passed here rather than
     * on the command line, and the map is scoped to a single exec — process.env is never mutated.
     */
    public static buildEnvironment(
        connectionConfig: SqlConnectionConfig,
        credentials?: SqlcmdCredentials
    ): { [key: string]: string } {
        const envVars: { [key: string]: string } = Object.assign({}, process.env, credentials?.envOverrides);

        if (connectionConfig.Password) {
            // go-sqlcmd reads SQLCMDPASSWORD automatically for SQL auth and AAD password/SP auth.
            envVars[Constants.sqlcmdPasswordEnvVarName] = connectionConfig.Password;
        }

        return envVars;
    }

    /**
     * Build the server/database/authentication portion of a sqlcmd command line.
     *
     * This is the single source of truth for how a connection string maps to go-sqlcmd
     * authentication flags. Both script execution and the firewall connectivity probe use
     * it so the two can never authenticate as different identities.
     *
     * Per spec: UTF-8 encoding is preserved by default with go-sqlcmd (no codepage flag needed).
     *
     * @param database Overrides the database from the connection string (the probe uses master).
     * @param loginTimeoutSeconds Value for -l.
     */
    public static buildConnectionArguments(
        connectionConfig: SqlConnectionConfig,
        credentials?: SqlcmdCredentials,
        loginTimeoutSeconds: number = 30,
        database?: string
    ): string[] {
        const tenantId = credentials?.tenantId;
        const authMethodOverride = credentials?.authMethodOverride;
        const args: string[] = [];

        // Server (with port if specified)
        args.push('-S');
        args.push(
            connectionConfig.Port
                ? `${connectionConfig.Server},${connectionConfig.Port}`
                : connectionConfig.Server
        );

        // Database
        const targetDatabase = database || connectionConfig.Database;
        if (targetDatabase) {
            args.push('-d');
            args.push(targetDatabase);
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
                // A Workload Identity Federation service connection cannot authenticate
                // through the DefaultAzureCredential chain, so the caller substitutes
                // ActiveDirectoryAzurePipelines. That credential takes its client/tenant/
                // connection id from AZURESUBSCRIPTION_* env vars, so no -U is passed.
                addAuthenticationMethod(authMethodOverride ?? 'ActiveDirectoryDefault');
                break;

            case 'activedirectoryintegrated':
                addAuthenticationMethod(authMethodOverride ?? 'ActiveDirectoryIntegrated');
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
                addAuthenticationMethod(authMethodOverride ?? 'ActiveDirectoryManagedIdentity');
                if (!authMethodOverride) {
                    addUser();
                }
                break;

            default:
                // SQL Authentication — UserId required, password via SQLCMDPASSWORD
                addUser();
                break;
        }

        // Login timeout
        args.push('-l');
        args.push(String(loginTimeoutSeconds));

        return args;
    }

    /**
     * Returns true when the caller has already specified sqlcmd's error-handling behaviour,
     * so the task should not impose its own default.
     */
    private static specifiesErrorHandling(additionalArguments?: string): boolean {
        return /(^|\s)(-b|--exit-on-error)(\s|=|$)/.test(additionalArguments ?? '');
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
