import * as tl from 'azure-pipelines-task-lib/task';
import Constants from './Constants';

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
        this._validateConnectionString(connectionString);

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
     * Parse connection string into key-value pairs.
     * Handles quoted values and unquotes them.
     */
    private _parseConnectionString(connectionString: string): Map<string, string> {
        const result = new Map<string, string>();
        
        const matches = Array.from(connectionString.matchAll(Constants.connectionStringParserRegex));
        for (const match of matches) {
            if (match.groups) {
                const key = match.groups.key.trim().toLowerCase();
                let val = match.groups.val.trim();

                // Remove outer quotes and unescape inner quotes
                if (val.startsWith('"') && val.endsWith('"')) {
                    // Remove outer quotes
                    val = val.slice(1, -1);
                    // Unescape double quotes ("" becomes ")
                    val = val.replace(/""/g, '"');
                } else if (val.startsWith("'") && val.endsWith("'")) {
                    // Remove outer quotes
                    val = val.slice(1, -1);
                    // Unescape single quotes ('' becomes ')
                    val = val.replace(/''/g, "'");
                }

                // Synonymous spellings share one canonical name, so a later occurrence overwrites an
                // earlier one exactly as SqlConnectionStringBuilder does.
                const canonicalKey = SqlConnectionConfig.CanonicalKeys.get(key) ?? key;
                result.set(canonicalKey, val);
                this._originalKeyNames.push(match.groups.key.trim());
            }
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
     * The basic format of a connection string includes a series of keyword/value pairs separated by semicolons. 
     * The equal sign (=) connects each keyword and its value. (Ex: Key1=Val1;Key2=Val2)
     * 
     * Following rules are to be followed while passing special characters in values:
            1. To include values that contain a semicolon, single-quote character, or double-quote character, the value must be enclosed in double quotation marks. 
            2. If the value contains both a semicolon and a double-quote character, the value can be enclosed in single quotation marks. 
            3. The single quotation mark is also useful if the value starts with a double-quote character. Conversely, the double quotation mark can be used if the value starts with a single quotation mark. 
            4. If the value contains both single-quote and double-quote characters, the quotation mark character used to enclose the value must be doubled every time it occurs within the value.
        
        Regex used by the parser(connectionStringParserRegex) to parse the VALUE:
            
            ('[^']*(''[^']*)*') -> value enclosed with single quotes and has consecutive single quotes 
            |("[^"]*(""[^"]*)*") -> value enclosed with double quotes and has consecutive double quotes
            |((?!['"])[^;]*)) -> value does not start with quotes does not contain any special character. Here we do a positive lookahead to ensure that the value doesn't start with quotes which should have been handled in previous cases
        Regex used to validate the entire connection string:
        
        A connection string is considered valid if it is a series of key/value pairs separated by semicolons. Each key/value pair must satisfy the connectionStringParserRegex to ensure it is a valid key/value pair.
        ^[;\s]*{KeyValueRegex}(;[;\s]*{KeyValueRegex})*[;\s]*$
        where KeyValueRegex = ([\w\s]+=(?:('[^']*(''[^']*)*')|("[^"]*(""[^"]*)*")|((?!['"])[^;]*))))
    */
    private _validateConnectionString(connectionString: string) {
        if (!Constants.connectionStringTester.test(connectionString)) {
            throw new Error(tl.loc('InvalidConnectionString'));
        }
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
