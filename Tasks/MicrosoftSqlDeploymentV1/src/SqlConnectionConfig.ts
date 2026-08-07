import * as tl from 'azure-pipelines-task-lib/task';
import Constants from './Constants';

export default class SqlConnectionConfig {
    private _parsedConnectionString: Map<string, string>;
    private _rawConnectionString: string;

    constructor(connectionString: string) {
        this._validateConnectionString(connectionString);

        this._rawConnectionString = connectionString;
        this._parsedConnectionString = this._parseConnectionString(connectionString);

        this._maskSecrets();
        this._validateConfig();
    }

    public get Server(): string {
        let server = this._getConnectionStringValue('data source') || this._getConnectionStringValue('server');
        if (!server) {
            return '';
        }
        
        // Remove port number
        if (server.includes(',')) {
            server = server.split(',')[0].trim();
        }
        // Remove tcp protocol
        if (server.startsWith('tcp:')) {
            server = server.slice(4).trim();
        }
        return server;
    }

    public get Port(): number | undefined {
        const server = this._getConnectionStringValue('data source') || this._getConnectionStringValue('server');
        if (server && server.includes(',')) {
            return parseInt(server.split(',')[1].trim());
        }
        return undefined;
    }

    public get Database(): string {
        return this._getConnectionStringValue('initial catalog') || this._getConnectionStringValue('database') || '';
    }

    public get UserId(): string | undefined {
        return this._getConnectionStringValue('user id') || this._getConnectionStringValue('user');
    }

    public get Password(): string | undefined {
        return this._getConnectionStringValue('password');
    }

    /**
     * Returns the authentication type used in the connection string, with spaces removed and in lower case.
     */
    public get FormattedAuthentication(): string | undefined {
        const auth = this._getConnectionStringValue('authentication');
        return auth?.replace(/\s/g, '').toLowerCase();
    }

    /**
     * Returns the connection string escaped by double quotes for command line usage.
     */
    public get EscapedConnectionString(): string {
        let result = '';

        // Isolate all the key value pairs from the raw connection string
        // Using the raw connection string instead of the parsed one to keep it as close to the original as possible
        const matches = Array.from(this._rawConnectionString.matchAll(Constants.connectionStringParserRegex));
        for (const match of matches) {
            if (match.groups) {
                const key = match.groups.key.trim();
                let val = match.groups.val.trim();

                // If the value is enclosed in double quotes, escape the double quotes
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = '""' + val.slice(1, -1) + '""';
                }

                result += `${key}=${val};`;
            }
        }

        return result;
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

                result.set(key, val);
            }
        }

        return result;
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
        if (!this.Server) {
            throw new Error(tl.loc('ConnectionStringMissingServer'));
        }

        if (!this.Database) {
            throw new Error(tl.loc('ConnectionStringMissingDatabase'));
        }

        switch (this.FormattedAuthentication) {
            case undefined:
            case 'sqlpassword': {
                // SQL password
                if (!this.UserId) {
                    throw new Error(tl.loc('ConnectionStringMissingUserId'));
                }
                if (!this.Password) {
                    throw new Error(tl.loc('ConnectionStringMissingPassword'));
                }
                break;
            }
            case 'activedirectorypassword': {
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
            case 'activedirectorydefault': {
                // These authentication types don't require user ID or password
                // Active Directory Integrated uses Windows authentication
                // Active Directory Default uses managed identity or workload identity
                break;
            }
        }
    }
}
