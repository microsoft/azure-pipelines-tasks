import tl = require('azure-pipelines-task-lib/task');
import SqlConnectionConfig from './SqlConnectionConfig';
import Constants from './Constants';

export interface ConnectionResult {
    /** True if connection succeeds, false otherwise */
    success: boolean;
    /** Connection error message on failure */
    errorMessage?: string;
    /** Client IP address if connection fails due to firewall rule */
    ipAddress?: string;
}

export default class SqlUtils {
    /**
     * Tries connection to server to determine if client IP address is restricted by the firewall.
     * First tries with master database, and then with user database if first one fails.
     * @param connectionConfig The connection configuration to try
     * @param sqlcmdPath Path to sqlcmd executable
     * @returns The client IP address if firewall restriction is present, or an empty string if connection succeeds
     */
    public static async detectIPAddress(connectionConfig: SqlConnectionConfig, sqlcmdPath: string): Promise<string> {
        tl.debug(tl.loc('DetectingIPAddress'));

        // First try connection to master
        let result = await this.tryConnection(connectionConfig, sqlcmdPath, true);
        if (result.success) {
            tl.debug(tl.loc('ConnectionSuccessful'));
            return '';
        } else if (result.ipAddress) {
            tl.debug(tl.loc('IPAddressDetected', result.ipAddress));
            return result.ipAddress;
        }

        // Retry connection with user database
        result = await this.tryConnection(connectionConfig, sqlcmdPath, false);
        if (result.success) {
            tl.debug(tl.loc('ConnectionSuccessful'));
            return '';
        } else if (result.ipAddress) {
            tl.debug(tl.loc('IPAddressDetected', result.ipAddress));
            return result.ipAddress;
        } else {
            // Connection failed but not due to firewall
            throw new Error(tl.loc('FailedToDetectIPAddress', result.errorMessage || 'Unknown error'));
        }
    }

    /**
     * Tries connection with the specified configuration
     * @param config Configuration for the connection
     * @param sqlcmdPath Path to sqlcmd executable
     * @param useMaster If true, uses "master" instead of the database specified in config
     * @returns A ConnectionResult object indicating success/failure
     */
    private static async tryConnection(
        config: SqlConnectionConfig,
        sqlcmdPath: string,
        useMaster?: boolean
    ): Promise<ConnectionResult> {
        const database = useMaster ? 'master' : config.Database;
        
        tl.debug(`Validating if client has access to '${database}' on '${config.Server}'`);

        let sqlcmdError = '';
        let sqlcmdOutput = '';

        try {
            // Build sqlcmd command with connection info
            const sqlcmdArgs = this.buildSqlCmdArgs(config, database);
            
            // Add query to execute
            sqlcmdArgs.push('-Q', `SELECT 'Validating connection from Azure Pipelines SQL Deployment Task'`);

            // Execute sqlcmd
            const result = await tl.exec(sqlcmdPath, sqlcmdArgs, {
                silent: true,
                ignoreReturnCode: true,
                outStream: new tl.WritableStream({
                    write: (chunk: string) => {
                        sqlcmdOutput += chunk;
                        return true;
                    }
                }),
                errStream: new tl.WritableStream({
                    write: (chunk: string) => {
                        sqlcmdError += chunk;
                        return true;
                    }
                })
            });

            if (result === 0) {
                // Connection succeeded
                return { success: true };
            } else {
                // Connection failed
                return {
                    success: false,
                    errorMessage: sqlcmdError || sqlcmdOutput,
                    ipAddress: this.parseErrorForIpAddress(sqlcmdError + sqlcmdOutput)
                };
            }
        } catch (error) {
            tl.debug(`Connection test error: ${error.message || error}`);
            tl.debug(`SqlCmd stderr: ${sqlcmdError}`);
            tl.debug(`SqlCmd stdout: ${sqlcmdOutput}`);
            
            return {
                success: false,
                errorMessage: sqlcmdError || sqlcmdOutput || (error.message || error),
                ipAddress: this.parseErrorForIpAddress(sqlcmdError + sqlcmdOutput)
            };
        }
    }

    /**
     * Parse an error message to see if it contains an IP address
     * @param errorMessage The error message to parse
     * @returns The IP address if found, otherwise undefined
     */
    private static parseErrorForIpAddress(errorMessage: string): string | undefined {
        const ipAddresses = errorMessage.match(Constants.ipv4MatchPattern);
        if (ipAddresses && ipAddresses.length > 0) {
            return ipAddresses[0];
        }
        return undefined;
    }

    /**
     * Builds sqlcmd arguments with connection settings
     * @param connectionConfig The connection settings
     * @param database The database to connect to
     * @returns Array of sqlcmd arguments
     */
    private static buildSqlCmdArgs(connectionConfig: SqlConnectionConfig, database?: string): string[] {
        const args: string[] = [];

        // Server and database
        args.push('-S', connectionConfig.Server);
        args.push('-d', database || connectionConfig.Database);

        // Authentication
        const auth = connectionConfig.FormattedAuthentication;
        
        if (!auth || auth === 'sqlauthentication') {
            // SQL Authentication
            if (connectionConfig.UserId) {
                args.push('-U', connectionConfig.UserId);
            }
            if (connectionConfig.Password) {
                args.push('-P', connectionConfig.Password);
            }
        } else if (auth === 'activedirectorydefault') {
            // AAD Default (Managed Identity)
            args.push('-G');
        } else if (auth === 'activedirectoryserviceprincipal') {
            // AAD Service Principal
            args.push('-G');
            if (connectionConfig.UserId) {
                args.push('-U', connectionConfig.UserId);
            }
            if (connectionConfig.Password) {
                args.push('-P', connectionConfig.Password);
            }
        } else if (auth === 'activedirectorypassword') {
            // AAD Password
            args.push('-G');
            if (connectionConfig.UserId) {
                args.push('-U', connectionConfig.UserId);
            }
            if (connectionConfig.Password) {
                args.push('-P', connectionConfig.Password);
            }
        } else if (auth === 'activedirectoryintegrated') {
            // AAD Integrated
            args.push('-G');
        }

        // Connection timeout for test (short)
        args.push('-l', '15');

        return args;
    }
}
