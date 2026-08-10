import tl = require('azure-pipelines-task-lib/task');
import SqlConnectionConfig from './SqlConnectionConfig';
import Constants from './Constants';
import { SqlcmdExecutor, SqlcmdCredentials } from './SqlcmdExecutor';

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
     * @param credentials Service connection identity, so the probe authenticates as the same
     *                    identity the deployment will use rather than the agent's ambient one
     * @returns The client IP address if firewall restriction is present, or an empty string if connection succeeds
     */
    public static async detectIPAddress(
        connectionConfig: SqlConnectionConfig,
        sqlcmdPath: string,
        credentials?: SqlcmdCredentials
    ): Promise<string> {
        tl.debug(tl.loc('DetectingIPAddress'));

        // First try connection to master
        let result = await this.tryConnection(connectionConfig, sqlcmdPath, true, credentials);
        if (result.success) {
            tl.debug(tl.loc('ConnectionSuccessful'));
            return '';
        } else if (result.ipAddress) {
            tl.debug(tl.loc('IPAddressDetected', result.ipAddress));
            return result.ipAddress;
        }

        // Retry connection with user database
        result = await this.tryConnection(connectionConfig, sqlcmdPath, false, credentials);
        if (result.success) {
            tl.debug(tl.loc('ConnectionSuccessful'));
            return '';
        } else if (result.ipAddress) {
            tl.debug(tl.loc('IPAddressDetected', result.ipAddress));
            return result.ipAddress;
        } else {
            // Connection failed but not due to firewall
            const detail = result.errorMessage
                || `sqlcmd exited without output while connecting to '${connectionConfig.Server}'. `
                 + `Run the pipeline with system.debug enabled to capture the sqlcmd command and output.`;
            throw new Error(tl.loc('FailedToDetectIPAddress', detail));
        }
    }

    /**
     * Tries connection with the specified configuration
     * @param config Configuration for the connection
     * @param sqlcmdPath Path to sqlcmd executable
     * @param useMaster If true, uses "master" instead of the database specified in config
     * @param credentials Service connection identity to authenticate the probe with
     * @returns A ConnectionResult object indicating success/failure
     */
    private static async tryConnection(
        config: SqlConnectionConfig,
        sqlcmdPath: string,
        useMaster?: boolean,
        credentials?: SqlcmdCredentials
    ): Promise<ConnectionResult> {
        const database = useMaster ? 'master' : config.Database;
        
        tl.debug(`Validating if client has access to '${database}' on '${config.Server}'`);

        let sqlcmdError = '';
        let sqlcmdOutput = '';

        try {
            // Reuse the deployment's argument builder so the probe and the deployment can
            // never authenticate as different identities. 15s login timeout is enough for a
            // connectivity probe without blocking the pipeline.
            const sqlcmdArgs = SqlcmdExecutor.buildConnectionArguments(config, credentials, 15, database);

            // Add query to execute
            sqlcmdArgs.push('-Q', `SELECT 'Validating connection from Azure Pipelines SQL Deployment Task'`);

            // Secrets go through a scoped env map — process.env is never mutated.
            const sqlcmdEnv = SqlcmdExecutor.buildEnvironment(config, credentials);

            // Output is captured through the stdout/stderr events because task-lib only writes
            // to outStream/errStream when silent is false. Combining silent with custom streams
            // captures nothing, which leaves the probe unable to read the firewall message and
            // therefore unable to parse the client IP out of it.
            const runner = tl.tool(sqlcmdPath).arg(sqlcmdArgs);
            runner.on('stdout', (data: Buffer) => { sqlcmdOutput += data.toString(); });
            runner.on('stderr', (data: Buffer) => { sqlcmdError += data.toString(); });

            const result = await runner.exec({
                env: sqlcmdEnv,
                silent: true,
                ignoreReturnCode: true
            } as any);

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
}

