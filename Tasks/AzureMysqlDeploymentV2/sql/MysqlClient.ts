import { ISqlClient } from './ISqlClient';
import { FirewallConfiguration } from '../models/FirewallConfiguration';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { Utility } from '../operations/MysqlUtility';
import * as telemetry from '../telemetry';
import task = require("azure-pipelines-task-lib/task");
var packageUtility = require('azure-pipelines-tasks-webdeployment-common/packageUtility.js');
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

export type SpawnFn = typeof child_process.spawn;

export class MysqlClient implements ISqlClient {

    // Hardening is on by default. This flag is a rollback switch: setting it true falls
    // back to the pre-hardening legacy behavior, so a regression can be mitigated by
    // flipping the flag instead of waiting on a new rollout.
    private static readonly ROLLBACK_FEATURE_FLAG = 'RollbackAzureMysqlDeploymentV2BinaryModeHardening';

    /**
     * Matches any spelling/casing variant of the binary-mode option that mysql accepts.
     */
    private static readonly BINARY_MODE_OPTION_PATTERN = /^--(?:(?:skip|disable|enable|maximum|loose)-)*binary-mode$/;

    private static readonly VALUE_CONSUMING_OPTIONS = new Set([
        '--bind-address', '--character-sets-dir', '--connect-timeout', '--database',
        '--default-auth', '--default-character-set',
        '--delimiter', '--execute', '--histignore', '--host',
        '--init-command', '--max-allowed-packet', '--max-join-size',
        '--net-buffer-length', '--plugin-dir', '--port', '--prompt', '--protocol',
        '--select-limit', '--server-public-key-path', '--shared-memory-base-name', '--socket',
        '--ssl-ca', '--ssl-capath', '--ssl-cert', '--ssl-cipher', '--ssl-crl', '--ssl-crlpath',
        '--ssl-key', '--ssl-mode', '--tls-version', '--user'
    ]);

    private static readonly SHORT_VALUE_CONSUMING_OPTIONS = new Set(['D', 'e', 'h', 'P', 'S', 'u']);

    private _azureMysqlTaskParameter: AzureMysqlTaskParameter;
    private _hostName: string;
    private _toolPath: string;
    private _spawn: SpawnFn;
    // Only populated when hardening is enabled 
    private _additionalArgumentTokens: string[] = [];
    private _optionNameTokenIndices: Set<number> = new Set();
    private _hardeningEnabled: boolean;

    constructor(azureMysqlTaskParameter: AzureMysqlTaskParameter, serverName: string, toolPath: string, spawnFn?: SpawnFn) {
        if (!azureMysqlTaskParameter) {
            throw new Error(task.loc("AzureMysqlTaskParameterCannotBeEmpty"));
        }
        if (!serverName ||typeof serverName.valueOf() !== 'string') {
            throw new Error(task.loc("MysqlServerNameCannotBeEmpty"));
        }
        if (!toolPath ||typeof toolPath.valueOf() !== 'string') {
            throw new Error(task.loc("ToolPathCannotBeNull"));
        }

        this._azureMysqlTaskParameter = azureMysqlTaskParameter;
        this._hostName = serverName;
        this._toolPath = toolPath;
        this._spawn = spawnFn || child_process.spawn;

        // Ensure the password is masked in pipeline logs even when
        // using child_process.spawn (which bypasses task-lib exec).
        const password = azureMysqlTaskParameter.getSqlPassword();
        if (password) {
            task.setSecret(password);
        }

        this._hardeningEnabled = !task.getPipelineFeature(MysqlClient.ROLLBACK_FEATURE_FLAG);
        if (this._hardeningEnabled) {
            this._additionalArgumentTokens = Utility.argStringToArray(azureMysqlTaskParameter.getSqlAdditionalArguments() || '');
            // A required value can look like an option; mark it so it is never
            // independently interpreted as one
            let skipNext = false;
            this._additionalArgumentTokens.forEach((token, index) => {
                if (skipNext) {
                    skipNext = false;
                    return;
                }
                this._optionNameTokenIndices.add(index);
                if (MysqlClient._consumesNextArgument(token)) {
                    skipNext = true;
                }
            });
            this._rejectBinaryModeArguments();
        }
    }

    private static _consumesNextArgument(token: string): boolean {
        if (token.startsWith('--')) {
            if (token.includes('=')) {
                return false;
            }
            let optionName = token.replace(/_/g, '-');
            let modifier = '';
            while (!MysqlClient.VALUE_CONSUMING_OPTIONS.has(optionName)) {
                const match = optionName.match(/^--(skip|disable|enable|maximum|loose)-(.+)$/);
                if (!match) {
                    return false;
                }
                modifier = match[1];
                optionName = '--' + match[2];
            }
            // This option is absent outside Windows; an unknown loose option consumes no value.
            if (optionName === '--shared-memory-base-name' && process.platform !== 'win32') {
                return false;
            }
            // The innermost modifier controls whether mysql supplies an implicit value.
            return modifier !== 'skip' && modifier !== 'disable' && modifier !== 'enable';
        }

        if (token.startsWith('-')) {
            for (let index = 1; index < token.length; index++) {
                const option = token[index];
                if (MysqlClient.SHORT_VALUE_CONSUMING_OPTIONS.has(option)) {
                    return index === token.length - 1;
                }
                // Optional short-option values must be attached, consuming the rest of the token.
                if (option === 'p' || option === '#' || option === ',') {
                    return false;
                }
            }
        }
        return false;
    }

    /**
     * Reject any SqlAdditionalArguments token that configures --binary-mode
     */
    private _rejectBinaryModeArguments(): void {
        const disallowedToken = this._additionalArgumentTokens.find((token, index) => {
            if (!this._optionNameTokenIndices.has(index)) {
                return false;
            }
            const optionName = token.split('=', 1)[0].replace(/_/g, '-').toLowerCase();
            return MysqlClient.BINARY_MODE_OPTION_PATTERN.test(optionName);
        });
        if (disallowedToken) {
            throw new Error(task.loc("SqlAdditionalArgumentNotAllowed", disallowedToken));
        }
    }

    /**
     * Get Firewall configuration related to agent box
     */
    public getFirewallConfiguration(): FirewallConfiguration {
        let firewallConfiguration: FirewallConfiguration = new FirewallConfiguration(true);
        // Regex to extract Ip Address from string
        const regexToGetIpAddress = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        const result = task.execSync(this._toolPath, this._hardeningEnabled
            ? this._buildConnectionArgs()
            : Utility.argStringToArray(this._getArgumentString() +" "+ this._getAdditionalArgument()));
        task.debug('Mysql server connection check result: '+JSON.stringify(result));
        // If agent is not whitelisted it will throw error with ip address 
        if(result && result.stderr){
            var ipAddresses = result.stderr.match(regexToGetIpAddress);
            if(ipAddresses && ipAddresses.length > 0){
                firewallConfiguration = new FirewallConfiguration(false, ipAddresses[0]);         
            }
        }
        return firewallConfiguration;
    }

    /**
     * Build the hardened mysql connection argv string array.
     *
     * --binary-mode is always placed immediately after the connection credentials and
     * before any user-supplied SqlAdditionalArguments tokens.
     */
    private _buildConnectionArgs(): string[] {
        const args = [
            '-h' + this._hostName,
            '-u' + this._azureMysqlTaskParameter.getSqlUserName(),
            '-p' + this._azureMysqlTaskParameter.getSqlPassword()
        ];
        if (!this._hasSslModeInAdditionalArgs()) {
            args.push('--ssl-mode=REQUIRED');
        }
        args.push('--binary-mode');
        return args.concat(this._additionalArgumentTokens);
    }

    /**
     * Get the connection argument for mysql.
     * Note: Flexible Server uses username without @servername suffix.
     * Appends --ssl-mode=REQUIRED unless the user already specified --ssl-mode
     * in SqlAdditionalArguments.
     */
    private _getArgumentString(): string{
        let argumentString = "-h" + this._hostName + " -u" + this._azureMysqlTaskParameter.getSqlUserName() + " -p" + this._azureMysqlTaskParameter.getSqlPassword();
        if (!this._hasSslModeInAdditionalArgs()) {
            argumentString += " --ssl-mode=REQUIRED";
        }
        return argumentString;
    }

    /**
     * Check if the user already specified --ssl-mode in SqlAdditionalArguments.
     */
    private _hasSslModeInAdditionalArgs(): boolean {
        const additional = this._azureMysqlTaskParameter.getSqlAdditionalArguments();
        return !!additional && /--ssl-mode/i.test(additional);
    }

    /**
     * Execute Mysql script
     */
    public async executeSqlCommand() : Promise<number> {
        if (this._hardeningEnabled) {
            let additionalArgumentTelemtry = {additionalArguments: Utility.getAdditionalArgumentForTelemtry(this._getAdditionalArgument())};
            telemetry.emitTelemetry('TaskHub', 'AzureMysqlDeployment', additionalArgumentTelemtry);

            let args = this._buildConnectionArgs();
            if (this._azureMysqlTaskParameter.getDatabaseName()) {
                // Creating database if it doesn't exist
                await this._executeSqlScriptArgs([...args, ...this._createDatabaseScriptArgsIfItDoesnotExist()]);
                args = [...args, '-D' + this._azureMysqlTaskParameter.getDatabaseName()];
            }
            if (this._azureMysqlTaskParameter.getTaskNameSelector() === 'InlineSqlTask') {
                return this._executeSqlScriptArgs([...args, '-e', this._azureMysqlTaskParameter.getSqlInline()]);
            }
            return this._executeSqlScriptFromFileArgs(args);
        }

        let argument: string = this._getArgumentString() +" "+ this._getAdditionalArgument();
        let additionalArgumentTelemtry = {additionalArguments: Utility.getAdditionalArgumentForTelemtry(this._getAdditionalArgument())};
        telemetry.emitTelemetry('TaskHub', 'AzureMysqlDeployment', additionalArgumentTelemtry);
        if(this._azureMysqlTaskParameter.getDatabaseName()){
            // Creating database if it doesn't exist 
            await this._executeSqlScript(argument + this._createDatabaseScriptIfItDoesnotExist());
            argument += " -D" + this._azureMysqlTaskParameter.getDatabaseName();
            return this._runUserScript(argument);
        }else{
            return this._runUserScript(argument);
        }
    }

    private _createDatabaseScriptIfItDoesnotExist() : string {
        return " -e" + '"' + "CREATE DATABASE IF NOT EXISTS `" + this._azureMysqlTaskParameter.getDatabaseName() + "` ; "  + '"' ;
    }

    /**
     * Build the CREATE DATABASE IF NOT EXISTS statement for the configured database name.
     * Hardening-enabled (default) only: a ['-e', <raw SQL>] pair of discrete argv elements -
     * no quoting/escaping needed since the hardened path bypasses re-tokenization entirely.
     */
    private _createDatabaseScriptArgsIfItDoesnotExist() : string[] {
        return ['-e', "CREATE DATABASE IF NOT EXISTS `" + this._azureMysqlTaskParameter.getDatabaseName() + "`;"];
    }

    /**
     * Run the user-provided SQL script (inline or file-based)
     */
    private async _runUserScript(argument: string): Promise<number> {
        if (this._azureMysqlTaskParameter.getTaskNameSelector() === 'InlineSqlTask') {
            return this._executeSqlScript(argument + this._getFileSourceArgument());
        }
        return this._executeSqlScriptFromFile(argument);
    }

    private async _executeSqlScript(argument: string): Promise<number> {
        task.debug('Started execution of mysql script');
        const resultCode = await task.exec(this._toolPath, Utility.argStringToArray(argument));
        task.debug('Script execution on mysql server result: '+ resultCode);
        if(resultCode === 0){
            return resultCode;
        }
        throw new Error(task.loc("SqlExecutionException", resultCode));
    }

    /**
     * Execute SQL script from file by piping file content via stdin.
     * Uses this._spawn (injectable for testing).
     */
    private _executeSqlScriptFromFile(argument: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            let settled = false;
            task.debug('Started execution of mysql script from file via stdin');
            const sqlFilePath = packageUtility.PackageUtility.getPackagePath(this._azureMysqlTaskParameter.getSqlFile());
            task.debug('  ' + sqlFilePath);
            if (!fs.existsSync(sqlFilePath)) {
                reject(new Error(task.loc("SqlFileNotFound", sqlFilePath)));
                return;
            }
            const args = Utility.argStringToArray(argument);
            const mysqlProcess = this._spawn(this._toolPath, args, { stdio: ['pipe', 'inherit', 'inherit'] });
            mysqlProcess.on('error', (err) => {
                if (!settled) {
                    settled = true;
                    reject(new Error(task.loc("SqlExecutionException", err.message)));
                }
            });
            mysqlProcess.stdin.on('error', (err) => {
                task.debug('stdin error: ' + err.message);
            });
            const fileStream = fs.createReadStream(sqlFilePath);
            fileStream.pipe(mysqlProcess.stdin);
            fileStream.on('error', (err) => {
                mysqlProcess.stdin.destroy();
                if (!settled) {
                    settled = true;
                    reject(new Error(task.loc("SqlExecutionException", err.message)));
                }
            });
            mysqlProcess.on('close', (code) => {
                task.debug('Script execution on mysql server result: ' + code);
                if (settled) return;
                settled = true;
                if (code === 0) {
                    resolve(code);
                } else {
                    reject(new Error(task.loc("SqlExecutionException", code)));
                }
            });
        });
    }

    /**
     * Hardening-enabled (default) sibling of _executeSqlScript: takes discrete argv elements
     * directly, with no tokenization, so SQL text with quotes/backslashes/spaces cannot be
     * misinterpreted as extra CLI arguments.
     */
    private async _executeSqlScriptArgs(args: string[]): Promise<number> {
        task.debug('Started execution of mysql script');
        const resultCode = await task.exec(this._toolPath, args);
        task.debug('Script execution on mysql server result: '+ resultCode);
        if(resultCode === 0){
            return resultCode;
        }
        throw new Error(task.loc("SqlExecutionException", resultCode));
    }

    /**
     * Hardening-enabled (default) sibling of _executeSqlScriptFromFile: takes discrete argv
     * elements directly, with no tokenization. Never called when the rollback flag is on
     * (legacy path).
     */
    private _executeSqlScriptFromFileArgs(args: string[]): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            let settled = false;
            task.debug('Started execution of mysql script from file via stdin');
            const sqlFilePath = packageUtility.PackageUtility.getPackagePath(this._azureMysqlTaskParameter.getSqlFile());
            task.debug('  ' + sqlFilePath);
            if (!fs.existsSync(sqlFilePath)) {
                reject(new Error(task.loc("SqlFileNotFound", sqlFilePath)));
                return;
            }
            const mysqlProcess = this._spawn(this._toolPath, args, { stdio: ['pipe', 'inherit', 'inherit'] });
            mysqlProcess.on('error', (err) => {
                if (!settled) {
                    settled = true;
                    reject(new Error(task.loc("SqlExecutionException", err.message)));
                }
            });
            mysqlProcess.stdin.on('error', (err) => {
                task.debug('stdin error: ' + err.message);
            });
            const fileStream = fs.createReadStream(sqlFilePath);
            fileStream.pipe(mysqlProcess.stdin);
            fileStream.on('error', (err) => {
                mysqlProcess.stdin.destroy();
                if (!settled) {
                    settled = true;
                    reject(new Error(task.loc("SqlExecutionException", err.message)));
                }
            });
            mysqlProcess.on('close', (code) => {
                task.debug('Script execution on mysql server result: ' + code);
                if (settled) return;
                settled = true;
                if (code === 0) {
                    resolve(code);
                } else {
                    reject(new Error(task.loc("SqlExecutionException", code)));
                }
            });
        });
    }

    /**
     * Additional connection argument passed by user
     */
    private _getAdditionalArgument() : string{
        return this._azureMysqlTaskParameter.getSqlAdditionalArguments() ? this._azureMysqlTaskParameter.getSqlAdditionalArguments() : "";
    }

    /**
     * Get connection argument for inline SQL execution
     */
    private _getFileSourceArgument() : string {
        const escaped = this._azureMysqlTaskParameter.getSqlInline().replace(/"/g, '\\"');
        return " -e" + '"' + escaped + '"';
    }
}
