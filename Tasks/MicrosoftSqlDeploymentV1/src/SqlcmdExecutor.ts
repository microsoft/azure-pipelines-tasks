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
    /** Client id of a user-assigned managed identity, passed to sqlcmd as -U. */
    userIdOverride?: string;
    /** Environment variables that carry the service connection identity to azidentity. */
    envOverrides?: { [key: string]: string };
    /**
     * Records the credential mechanism that supplied the identity, and is reported in
     * telemetry. An authentication failure can then be traced to the credential that was
     * actually used instead of being inferred from the error text.
     */
    source?: 'azurePipelines' | 'clientSecret' | 'clientCertificate' | 'managedIdentity' | 'tenantOnly';
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
        this.warnAboutUnappliedConnectionStringProperties(connectionConfig);

        const args = this.buildConnectionArguments(
            connectionConfig,
            credentials,
            connectionConfig.ConnectTimeoutSeconds ?? 30
        );

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
        args.push(this.validateInputFilePath(scriptPath));

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

        // Names only, never values: several of these carry secrets. Which variables were applied is
        // the one thing that cannot be recovered from the command line afterwards, and it is what
        // determines the identity and the Entra authority sqlcmd ends up using.
        const overrideNames = Object.keys(credentials?.envOverrides ?? {});
        if (overrideNames.length > 0) {
            tl.debug(`sqlcmd environment overrides: ${overrideNames.join(', ')}`);
        }

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
        const userIdOverride = credentials?.userIdOverride;
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
                // Set only for a user-assigned managed identity, which is selected by client id.
                if (userIdOverride) {
                    args.push('-U');
                    args.push(userIdOverride);
                }
                break;

            case 'activedirectoryintegrated':
                // go-sqlcmd does not implement this method and silently falls back to
                // ActiveDirectoryDefault, so the effective identity comes from the
                // DefaultAzureCredential chain rather than the caller's domain account. The
                // requested method is still passed through unchanged, and no service connection
                // override is applied, so the tool is never pointed at a different principal than
                // the connection string asked for.
                tl.warning(tl.loc('IntegratedAuthNotImplementedBySqlcmd'));
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

        // Transport security. sqlcmd neither encrypts nor validates the server certificate unless
        // it is told to, so a connection string that explicitly asks for encryption must be
        // translated into switches. Dropping them would quietly downgrade the connection.
        const encrypt = connectionConfig.Encrypt;
        if (encrypt) {
            args.push('-N');
            args.push(encrypt);
        }

        if (connectionConfig.TrustServerCertificate) {
            args.push('-C');
        }

        const hostNameInCertificate = connectionConfig.HostNameInCertificate;
        if (hostNameInCertificate) {
            args.push('-F');
            args.push(hostNameInCertificate);
        }

        // Explicit certificate pinning. Dropping it would fall back to the machine trust store,
        // which accepts certificates the caller did not ask to trust.
        const serverCertificate = connectionConfig.ServerCertificate;
        if (serverCertificate) {
            args.push('-J');
            args.push(serverCertificate);
        }

        // ReadWrite is the server default and has no switch, so only ReadOnly is translated.
        if (connectionConfig.ApplicationIntent === 'readonly') {
            args.push('-K');
            args.push('ReadOnly');
        }

        // Login timeout
        args.push('-l');
        args.push(String(loginTimeoutSeconds));

        return args;
    }

    /**
     * sqlcmd is driven by switches, not by a connection string, so only the properties that have a
     * matching switch survive the translation in buildConnectionArguments. The DACPAC path has no
     * such limitation because SqlPackage is handed the connection string whole. Warn rather than
     * fail: the properties left over after the security-relevant ones are translated are pooling
     * and diagnostic hints that do not change the outcome of a one-shot script run.
     */
    private static warnAboutUnappliedConnectionStringProperties(connectionConfig: SqlConnectionConfig): void {
        const applied = new Set<string>([
            'data source', 'server', 'addr', 'address', 'network address',
            'initial catalog', 'database',
            'user id', 'user', 'uid',
            'password', 'pwd',
            'authentication', 'integrated security', 'trusted_connection',
            'trustservercertificate', 'trust server certificate',
            'hostnameincertificate', 'host name in certificate',
            'servercertificate', 'server certificate',
            'applicationintent', 'application intent',
            'connect timeout', 'connection timeout', 'timeout'
        ]);

        // Encrypt only counts as applied when its value is one SqlClient defines; anything else is
        // reported so the user learns the encryption level they asked for was not honoured.
        if (connectionConfig.Encrypt) {
            applied.add('encrypt');
        }

        const ignored = connectionConfig.Keys.filter(key => !applied.has(key.toLowerCase()));
        if (ignored.length > 0) {
            tl.warning(tl.loc('SqlcmdConnectionPropertiesNotApplied', ignored.join(', ')));
        }
    }

    /**
     * Reject script paths that sqlcmd cannot receive unambiguously.
     *
     * -i takes a comma-separated list of files, so a comma inside a path is read as a separator
     * and sqlcmd looks for files that do not exist. Every other character the task might see -
     * spaces, semicolons, quotes, ampersands, equals signs, parentheses - passes through fine and
     * is left alone.
     *
     * Measured against go-sqlcmd v1.10: triple quoting does keep a comma-containing path intact,
     * but only when the path has no spaces, and it breaks paths that do. Rather than switching
     * quoting styles based on which characters are present, and rejecting the combination that
     * has no working form, commas are refused outright. The task takes a single file, so a comma
     * is always part of a name rather than a separator, and the user is told exactly what to change.
     */
    private static validateInputFilePath(scriptPath: string): string {
        if (scriptPath.indexOf(',') >= 0) {
            throw new Error(tl.loc('ScriptPathContainsComma', scriptPath));
        }

        return scriptPath;
    }

    /**
     * Returns true when the caller has already specified sqlcmd's error-handling behaviour,
     * so the task should not impose its own default.
     */
    private static specifiesErrorHandling(additionalArguments?: string): boolean {
        return /(^|\s)(-b|--exit-on-error)(\s|=|$)/.test(additionalArguments ?? '');
    }

    /**
     * Split an additional arguments string into argv elements.
     *
     * Quotes are treated as syntax and removed once they have done their job of keeping a value
     * together, so a quoted value arrives as a single argument without literal quote characters
     * in it.
     */
    private static parseAdditionalArguments(additionalArguments: string): string[] {
        const args: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        let hasContent = false;

        const flush = (): void => {
            args.push(current);
            current = '';
            hasContent = false;
        };

        for (const char of additionalArguments) {
            if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
                // An empty quoted value is still a value, so remember it was quoted.
                hasContent = true;
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
            } else if (char === ' ' && !inQuotes) {
                if (current.length > 0 || hasContent) {
                    flush();
                }
            } else {
                current += char;
            }
        }

        if (current.length > 0 || hasContent) {
            flush();
        }

        return args;
    }
}
