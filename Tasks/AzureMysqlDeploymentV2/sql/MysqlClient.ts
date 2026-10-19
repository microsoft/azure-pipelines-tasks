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

    private static readonly HARDENING_FEATURE_FLAG = 'EnableAzureMysqlDeploymentV2BinaryModeHardening';

    /**
     * Matches any spelling/casing variant of the binary-mode option that mysql accepts.
     */
    private static readonly BINARY_MODE_OPTION_PATTERN = /^--(?:(?:skip|disable|enable|maximum|loose)-)*binary-mode$/;

    /**
     * Matches the defaults-file option family.
     */
    private static readonly DEFAULTS_FILE_OPTION_PATTERN = /^--defaults(-extra)?-file$/;

    /**
     * Matches the defaults-group-suffix option family.
     */
    private static readonly DEFAULTS_GROUP_SUFFIX_PATTERN = /^--defaults(-extra)?-group-suffix$/;

    /**
     * Option-file sections relevant to the mysql client.
     */
    private static readonly CLIENT_OPTION_GROUPS = ['client', 'client-server', 'mysql'];

    private static readonly MAX_DEFAULTS_FILE_INCLUDE_DEPTH = 10;

    /**
     * File extensions mysql's !includedir loads.
     */
    private static readonly INCLUDEDIR_FILE_EXTENSIONS = ['.cnf', '.ini'];

    private _azureMysqlTaskParameter: AzureMysqlTaskParameter;
    private _hostName: string;
    private _toolPath: string;
    private _spawn: SpawnFn;
    // Only populated when hardening is enabled (see constructor) - ff-off never tokenizes
    // SqlAdditionalArguments during construction.
    private _additionalArgumentTokens: string[] = [];
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

        this._hardeningEnabled = task.getPipelineFeature(MysqlClient.HARDENING_FEATURE_FLAG);
        if (this._hardeningEnabled) {
            this._additionalArgumentTokens = Utility.argStringToArray(azureMysqlTaskParameter.getSqlAdditionalArguments() || '');
            this._rejectBinaryModeArguments();
        }
    }

    /**
     * Reject any SqlAdditionalArguments token that configures --binary-mode, either
     * directly (--binary-mode / --skip-binary-mode / etc.) or indirectly through an
     * option (.cnf) file referenced via --defaults-file / --defaults-extra-file.
     * Only called when hardening is enabled.
     */
    private _rejectBinaryModeArguments(): void {
        const disallowedToken = this._additionalArgumentTokens.find(token => {
            const optionName = token.split('=', 1)[0].replace(/_/g, '-').toLowerCase();
            return MysqlClient.BINARY_MODE_OPTION_PATTERN.test(optionName);
        });
        if (disallowedToken) {
            throw new Error(task.loc("SqlAdditionalArgumentNotAllowed", disallowedToken));
        }

        this._rejectBinaryModeInDefaultsFiles();
    }

    /**
     * Scans any option files referenced via --defaults-file / --defaults-extra-file in
     * SqlAdditionalArguments for a binary-mode key.
     *
     * --no-defaults disables all option-file loading, so nothing further needs checking
     * in that case.
     */
    private _rejectBinaryModeInDefaultsFiles(): void {
        const hasNoDefaults = this._additionalArgumentTokens.some(token =>
            token.split('=', 1)[0].replace(/_/g, '-').toLowerCase() === '--no-defaults');

        if (hasNoDefaults) {
            return;
        }

        const groupSuffixes = this._additionalArgumentTokens
            .filter(token => MysqlClient.DEFAULTS_GROUP_SUFFIX_PATTERN.test(
                token.split('=', 1)[0].replace(/_/g, '-').toLowerCase()))
            .map(token => token.slice(token.indexOf('=') + 1));

        for (const token of this._additionalArgumentTokens) {
            const separatorIndex = token.indexOf('=');
            const optionName = (separatorIndex === -1 ? token : token.slice(0, separatorIndex))
                .replace(/_/g, '-').toLowerCase();
            if (!MysqlClient.DEFAULTS_FILE_OPTION_PATTERN.test(optionName) || separatorIndex === -1) {
                continue;
            }
            const filePath = token.slice(separatorIndex + 1);
            if (!filePath) {
                continue; // malformed token; let mysql itself reject it
            }
            this._rejectBinaryModeInOptionFile(filePath, groupSuffixes, token, 0);
        }
    }

    /**
     * Scans a single mysql option (.cnf) file - and anything it !include(dir)s - for a key
     * that would reconfigure --binary-mode within a section the mysql client reads
     * ([client], [client-server], [mysql], and their --defaults-group-suffix variants).
     */
    private _rejectBinaryModeInOptionFile(
        filePath: string,
        groupSuffixes: string[],
        originToken: string,
        depth: number
    ): void {
        if (depth > MysqlClient.MAX_DEFAULTS_FILE_INCLUDE_DEPTH) {
            // Guards against unbounded/cyclical include chains.
            throw new Error(task.loc("SqlAdditionalArgumentNotAllowed", originToken));
        }

        const resolvedPath = path.resolve(filePath);
        let content: string;
        try {
            content = fs.readFileSync(resolvedPath, 'utf8');
        } catch {
            // Unreadable/missing file: mysql itself will fail on this path; nothing to scan.
            return;
        }

        const allowedGroups = new Set<string>();
        for (const baseGroup of MysqlClient.CLIENT_OPTION_GROUPS) {
            allowedGroups.add(baseGroup);
            for (const suffix of groupSuffixes) {
                allowedGroups.add(baseGroup + suffix);
            }
        }

        let currentGroup: string | null = null;
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#') || line.startsWith(';')) {
                continue;
            }

            const sectionMatch = line.match(/^\[([^\]]*)\]/);
            if (sectionMatch) {
                currentGroup = sectionMatch[1].trim().toLowerCase();
                continue;
            }

            const includeMatch = line.match(/^!include(dir)?\s+(.+)$/i);
            if (includeMatch) {
                const includedPaths = includeMatch[1]
                    ? fs.readdirSync(includeMatch[2].trim())
                        .filter(entry => MysqlClient.INCLUDEDIR_FILE_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
                        .map(entry => path.join(includeMatch[2].trim(), entry))
                    : [includeMatch[2].trim()];
                for (const includedPath of includedPaths) {
                    this._rejectBinaryModeInOptionFile(includedPath, groupSuffixes, originToken, depth + 1);
                }
                continue;
            }

            if (currentGroup === null || !allowedGroups.has(currentGroup)) {
                continue;
            }

            const key = '--' + line.split('=', 1)[0].trim().replace(/_/g, '-').toLowerCase();
            if (MysqlClient.BINARY_MODE_OPTION_PATTERN.test(key)) {
                throw new Error(task.loc("SqlAdditionalArgumentNotAllowed", originToken));
            }
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
     * Build the hardened mysql connection argv shared by every flag-on invocation
     * (firewall check, database creation, and script execution). Only called when
     * hardening is enabled.
     * Note: Flexible Server uses username without @servername suffix.
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
        this._emitExecutionTelemetry();

        if (this._hardeningEnabled) {
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
        if(this._azureMysqlTaskParameter.getDatabaseName()){
            // Creating database if it doesn't exist 
            await this._executeSqlScript(argument + this._createDatabaseScriptIfItDoesnotExist());
            argument += " -D" + this._azureMysqlTaskParameter.getDatabaseName();
            return this._runUserScript(argument);
        }else{
            return this._runUserScript(argument);
        }
    }

    /**
     * Emit a single telemetry event for this execution, derived directly from
     * _hardeningEnabled so the hardened/legacy label can never drift from the flag
     * state that actually decided the execution path below.
     */
    private _emitExecutionTelemetry(): void {
        telemetry.emitTelemetry('TaskHub', 'AzureMysqlDeployment', {
            additionalArguments: Utility.getAdditionalArgumentForTelemtry(this._getAdditionalArgument()),
            executionPath: this._hardeningEnabled ? 'hardened' : 'legacy'
        });
    }

    private _createDatabaseScriptIfItDoesnotExist() : string {
        return " -e" + '"' + "CREATE DATABASE IF NOT EXISTS `" + this._azureMysqlTaskParameter.getDatabaseName() + "` ; "  + '"' ;
    }

    /**
     * Build the CREATE DATABASE IF NOT EXISTS statement for the configured database name.
     * Flag-on only: a ['-e', <raw SQL>] pair of discrete argv elements - no quoting/escaping
     * needed since the flag-on path bypasses re-tokenization entirely.
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
     * Flag-on-only sibling of _executeSqlScript: takes discrete argv elements directly,
     * with no tokenization, so SQL text with quotes/backslashes/spaces cannot be
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
     * Flag-on-only sibling of _executeSqlScriptFromFile: takes discrete argv elements
     * directly, with no tokenization. Never called from the ff-off path.
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
