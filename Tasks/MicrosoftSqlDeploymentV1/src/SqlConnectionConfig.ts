import * as tl from 'azure-pipelines-task-lib/task';

export default class SqlConnectionConfig {
    private _parsedConnectionString: Map<string, string>;
    private _rawConnectionString: string;
    private _originalKeyNames: string[] = [];

    /**
     * SqlClient accepts several spellings for the same setting, and SqlPackage inherits them
     * because the connection string is handed to it whole. Validation must therefore accept every
     * spelling, otherwise a string that SqlPackage would have deployed is rejected here with an
     * error that names the wrong setting.
     *
     * Each spelling maps to one canonical name and the value is stored under that name while
     * parsing, so `Data Source=old;Server=new` resolves to `new` the way SqlConnectionStringBuilder
     * does. Preferring one spelling over another regardless of position would read a different
     * server, database or credential than the connection string handed to SqlPackage.
     *
     * https://learn.microsoft.com/dotnet/api/system.data.sqlclient.sqlconnection.connectionstring
     */
    private static readonly CanonicalKeys: ReadonlyMap<string, string> = new Map<string, string>([
        ['data source', 'server'],
        ['server', 'server'],
        ['addr', 'server'],
        ['address', 'server'],
        ['network address', 'server'],
        ['initial catalog', 'database'],
        ['database', 'database'],
        ['user id', 'user id'],
        ['user', 'user id'],
        ['uid', 'user id'],
        ['password', 'password'],
        ['pwd', 'password'],
        ['trust server certificate', 'trustservercertificate'],
        ['trustservercertificate', 'trustservercertificate'],
        ['host name in certificate', 'hostnameincertificate'],
        ['hostnameincertificate', 'hostnameincertificate'],
        ['server certificate', 'servercertificate'],
        ['servercertificate', 'servercertificate'],
        ['application intent', 'applicationintent'],
        ['applicationintent', 'applicationintent'],
        ['connect timeout', 'connect timeout'],
        ['connection timeout', 'connect timeout'],
        ['timeout', 'connect timeout'],
        ['integrated security', 'integrated security'],
        ['trusted_connection', 'integrated security']
    ]);

    constructor(connectionString: string) {
        this._rawConnectionString = connectionString;
        this._parsedConnectionString = this._parseConnectionString(connectionString);

        this._maskSecrets();
        this._validateConfig();
    }

    public get Server(): string {
        let server = this._getConnectionStringValue('server');
        if (!server) {
            return '';
        }
        
        // SQL Server connection strings may include the port as "server,port" (e.g. "myserver.database.windows.net,1433").
        // The Server getter returns only the hostname so callers can use it for DNS lookups, ARM API server name
        // matching, and firewall rule management — all of which expect just the hostname without the port.
        if (server.includes(',')) {
            server = server.split(',')[0].trim();
        }

        // ADO and ODBC connection strings sometimes include a "tcp:" transport prefix
        // (e.g. "tcp:myserver.database.windows.net,1433"). Strip it so the raw hostname is returned.
        if (server.startsWith('tcp:')) {
            server = server.slice(4).trim();
        }
        return server;
    }

    public get Port(): number | undefined {
        const server = this._getConnectionStringValue('server');
        if (server && server.includes(',')) {
            const port = parseInt(server.split(',')[1].trim(), 10);
            return Number.isFinite(port) ? port : undefined;
        }
        return undefined;
    }

    public get Database(): string {
        return this._getConnectionStringValue('database') || '';
    }

    public get UserId(): string | undefined {
        return this._getConnectionStringValue('user id');
    }

    public get Password(): string | undefined {
        return this._getConnectionStringValue('password');
    }

    /**
     * The requested encryption level, normalized to the values sqlcmd's -N switch accepts.
     * Returns undefined when the property is absent or holds a value SqlClient does not define,
     * so that callers report it as unapplied rather than passing it through to the tool.
     *
     * Mandatory and Optional are the current SqlClient spellings of True and False, so they must
     * map to the same switch value. Leaving them unrecognised would discard an explicit request
     * to encrypt, which is the one case where failing quietly is least acceptable.
     */
    public get Encrypt(): string | undefined {
        const value = this._getConnectionStringValue('encrypt')?.toLowerCase();
        switch (value) {
            case 'true':
            case 'mandatory':
            case 'yes':
            case '1':
                return 'true';
            case 'false':
            case 'optional':
            case 'no':
            case '0':
                return 'false';
            case 'strict':
                return 'strict';
            default:
                return undefined;
        }
    }

    public get TrustServerCertificate(): boolean {
        return this._parseBoolean(this._getConnectionStringValue('trustservercertificate'));
    }

    public get HostNameInCertificate(): string | undefined {
        return this._getConnectionStringValue('hostnameincertificate');
    }

    /** Path to the certificate the caller pins the server to, for sqlcmd's -J switch. */
    public get ServerCertificate(): string | undefined {
        return this._getConnectionStringValue('servercertificate');
    }

    public get ApplicationIntent(): string | undefined {
        return this._getConnectionStringValue('applicationintent')?.toLowerCase();
    }

    public get ConnectTimeoutSeconds(): number | undefined {
        const value = this._getConnectionStringValue('connect timeout');
        if (!value) {
            return undefined;
        }
        const seconds = parseInt(value, 10);
        return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
    }

    /**
     * True when the host names an Azure SQL Database logical server, the only deployment target
     * that has ARM firewall rules.
     *
     * A managed instance carries an extra DNS zone label (name.zone.database.windows.net) and is a
     * Microsoft.Sql/managedInstances resource with no IP firewall rules; Fabric SQL uses the
     * fabric.microsoft.com domain; SQL Server on a VM or on premises is not an ARM SQL resource at
     * all. None of them are returned when Microsoft.Sql/servers is enumerated. The cloud-specific
     * suffix is deliberately not enumerated here so that sovereign clouds are covered too.
     */
    public get IsAzureSqlDatabaseServer(): boolean {
        const host = this.Server.toLowerCase();
        return /^[^.]+\.database\./.test(host) && !host.includes('.fabric.');
    }

    /**
     * The property names exactly as the user spelled them, so diagnostics can quote the
     * connection string back rather than the lower-cased form used for lookups.
     */
    public get Keys(): string[] {
        return [...this._originalKeyNames];
    }

    /**
     * Returns the authentication type used in the connection string, with spaces removed and in lower case.
     */
    public get FormattedAuthentication(): string | undefined {
        const auth = this._getConnectionStringValue('authentication');
        return auth?.replace(/\s/g, '').toLowerCase();
    }

    /**
     * Returns the connection string exactly as the user supplied it.
     *
     * Callers pass this as a single argv element (never through a shell), so no extra
     * quoting is applied. SqlPackage parses it with standard ADO.NET rules, which already
     * define how quoted values and doubled quotes are escaped — rewriting them here would
     * corrupt valid values such as `Password="my""pass"`.
     */
    public get ConnectionString(): string {
        return this._rawConnectionString;
    }

    /**
     * Properties that name or carry an identity. A token supplies the identity on its own, and
     * SqlPackage rejects a connection string that also tries to authenticate.
     */
    private static readonly AuthenticationKeys: ReadonlySet<string> = new Set<string>([
        'authentication',
        'user id',
        'password',
        'integrated security'
    ]);

    /**
     * The connection string with every authentication property removed, for use alongside an
     * access token.
     *
     * Rebuilding the target from server and database alone silently dropped the rest of the
     * caller's settings, so an explicit `Encrypt=Strict` or a pinned `ServerCertificate` was not
     * applied to a token-authenticated deployment. SqlPackage has no /Target switch for several of
     * those properties, so they can only be preserved by passing a connection string.
     *
     * The server value is emitted exactly as it was supplied, which keeps a `host,port` endpoint
     * such as a managed instance on its own port instead of falling back to 1433.
     */
    public get ConnectionStringWithoutCredentials(): string {
        const pairs: string[] = [];

        for (const [key, value] of this._parsedConnectionString) {
            if (SqlConnectionConfig.AuthenticationKeys.has(key)) {
                continue;
            }
            pairs.push(`${key}=${SqlConnectionConfig._escapeValue(value)}`);
        }

        return pairs.join(';');
    }

    /**
     * Quote a value the way SqlConnectionStringBuilder does, so a value containing a separator or
     * a quote survives being parsed back out of the connection string.
     */
    private static _escapeValue(value: string): string {
        if (!/[;'"=]|^\s|\s$/.test(value)) {
            return value;
        }
        return `"${value.replace(/"/g, '""')}"`;
    }

    /**
     * Validate and parse in one forward pass to avoid backtracking on malformed input.
     */
    private _parseConnectionString(connectionString: string): Map<string, string> {
        const result = new Map<string, string>();
        let position = 0;

        while (position < connectionString.length) {
            let keyStart = position;
            while (position < connectionString.length && /[;\s]/.test(connectionString[position])) {
                if (connectionString[position++] === ';') {
                    keyStart = position;
                }
            }
            if (position === connectionString.length) {
                break;
            }

            while (position < connectionString.length && /[\w\s]/.test(connectionString[position])) {
                position++;
            }
            if (position === keyStart || connectionString[position] !== '=') {
                throw new Error(tl.loc('InvalidConnectionString'));
            }
            const originalKey = connectionString.slice(keyStart, position).trim();
            const key = originalKey.toLowerCase();
            const valueStart = ++position;
            const quote = connectionString[position];

            if (quote === '"' || quote === "'") {
                position++;
                let closed = false;
                while (position < connectionString.length) {
                    if (connectionString[position++] === quote) {
                        if (connectionString[position] === quote) {
                            position++;
                        } else {
                            closed = true;
                            break;
                        }
                    }
                }
                if (!closed) {
                    throw new Error(tl.loc('InvalidConnectionString'));
                }
            } else {
                while (position < connectionString.length && connectionString[position] !== ';') {
                    position++;
                }
            }

            let val = connectionString.slice(valueStart, position).trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1).replace(/""/g, '"');
            } else if (val.startsWith("'") && val.endsWith("'")) {
                val = val.slice(1, -1).replace(/''/g, "'");
            }

            if (position < connectionString.length && connectionString[position] !== ';') {
                // Whitespace after a quoted value is only accepted in the final separator suffix.
                while (position < connectionString.length && /[;\s]/.test(connectionString[position])) {
                    position++;
                }
                if (position !== connectionString.length) {
                    throw new Error(tl.loc('InvalidConnectionString'));
                }
            }

            // Synonymous spellings share one canonical name, so the last occurrence wins.
            const canonicalKey = SqlConnectionConfig.CanonicalKeys.get(key) ?? key;
            result.set(canonicalKey, val);
            this._originalKeyNames.push(originalKey);
        }

        if (result.size === 0) {
            throw new Error(tl.loc('InvalidConnectionString'));
        }

        return result;
    }

    /**
     * SqlClient treats yes/no as equivalent to true/false for boolean properties.
     */
    private _parseBoolean(value: string | undefined): boolean {
        const normalized = value?.trim().toLowerCase();
        return normalized === 'true' || normalized === 'yes';
    }

    /**
     * Get a value from the parsed connection string (case-insensitive key lookup).
     */
    private _getConnectionStringValue(key: string): string | undefined {
        return this._parsedConnectionString.get(key.toLowerCase());
    }

    /**
     * SqlClient rejects a value it cannot parse rather than falling back to the default, so a typo
     * must not silently change the encryption, certificate validation or routing of the connection.
     */
    private _validatePropertyValues(): void {
        const requireOneOf = (canonicalKey: string, displayName: string, allowed: string[]): void => {
            const value = this._getConnectionStringValue(canonicalKey);
            if (value !== undefined && !allowed.includes(value.trim().toLowerCase())) {
                throw new Error(tl.loc('InvalidConnectionStringPropertyValue', displayName, value, allowed.join(', ')));
            }
        };

        requireOneOf('encrypt', 'Encrypt', ['true', 'mandatory', 'yes', '1', 'false', 'optional', 'no', '0', 'strict']);
        requireOneOf('trustservercertificate', 'TrustServerCertificate', ['true', 'yes', 'false', 'no']);
        requireOneOf('applicationintent', 'ApplicationIntent', ['readonly', 'readwrite']);

        const connectTimeout = this._getConnectionStringValue('connect timeout');
        if (connectTimeout !== undefined && !/^\d+$/.test(connectTimeout.trim())) {
            throw new Error(tl.loc('InvalidConnectionStringPropertyValue', 'Connect Timeout', connectTimeout, 'a whole number of seconds'));
        }
    }

    /**
     * Mask sensitive parts of the connection settings so they don't show up in the pipeline logs.
     */
    private _maskSecrets(): void {
        // User ID could be client ID in some authentication types
        if (this.UserId) {
            tl.setSecret(this.UserId);
        }

        if (this.Password) {
            tl.setSecret(this.Password);
        }
    }

    private _validateConfig(): void {
        this._validatePropertyValues();

        if (!this.Server) {
            throw new Error(tl.loc('ConnectionStringMissingServer'));
        }

        if (!this.Database) {
            throw new Error(tl.loc('ConnectionStringMissingDatabase'));
        }

        switch (this.FormattedAuthentication) {
            case undefined: {
                // No Authentication= keyword. Check for Windows/trusted auth keywords that we don't support.
                const integratedSecurity = this._getConnectionStringValue('integrated security');
                if (integratedSecurity && (integratedSecurity.toLowerCase() === 'true' || integratedSecurity.toLowerCase() === 'yes')) {
                    throw new Error(tl.loc('UnsupportedAuthentication', 'Integrated Security=true'));
                }
                // Plain SQL auth — requires UserId and Password
                if (!this.UserId) {
                    throw new Error(tl.loc('ConnectionStringMissingUserId'));
                }
                if (!this.Password) {
                    throw new Error(tl.loc('ConnectionStringMissingPassword'));
                }
                break;
            }
            case 'sqlauthentication':
            case 'sqlpassword':
            case 'activedirectorypassword': {
                // Requires UserId and Password
                if (!this.UserId) {
                    throw new Error(tl.loc('ConnectionStringMissingUserId'));
                }
                if (!this.Password) {
                    throw new Error(tl.loc('ConnectionStringMissingPassword'));
                }
                break;
            }
            case 'activedirectoryserviceprincipal': {
                // User ID is client ID and password is secret
                if (!this.UserId) {
                    throw new Error(tl.loc('ConnectionStringMissingClientId'));
                }
                if (!this.Password) {
                    throw new Error(tl.loc('ConnectionStringMissingClientSecret'));
                }
                break;
            }
            case 'activedirectoryintegrated':
            case 'activedirectorydefault':
            case 'activedirectorymanagedidentity': {
                // These authentication types don't require user ID or password.
                // For activedirectorymanagedidentity, UserId is optional (user-assigned MI client ID).
                break;
            }
            default: {
                // Unknown Authentication= value (not in the supported types).
                // Supported: SQL auth (no keyword), Active Directory Default/Password/ServicePrincipal/Integrated/ManagedIdentity.
                throw new Error(tl.loc('UnsupportedAuthentication', this.FormattedAuthentication));
            }
        }
    }
}
