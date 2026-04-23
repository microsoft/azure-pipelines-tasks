import { ISqlClient } from './ISqlClient';
import { FirewallConfiguration } from '../models/FirewallConfiguration';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { Utility } from '../operations/MysqlUtility';
import * as telemetry from '../telemetry';
import task = require("azure-pipelines-task-lib/task");
var packageUtility = require('azure-pipelines-tasks-webdeployment-common/packageUtility.js');
import * as fs from 'fs';
import * as child_process from 'child_process';

export type SpawnFn = typeof child_process.spawn;

export class MysqlClient implements ISqlClient {
    private _azureMysqlTaskParameter: AzureMysqlTaskParameter;
    private _hostName: string;
    private _toolPath: string;
    private _spawn: SpawnFn;

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
    }

    /**
     * Get Firewall configuration related to agent box
     */
    public getFirewallConfiguration(): FirewallConfiguration {
        let firewallConfiguration: FirewallConfiguration = new FirewallConfiguration(true);
        // Regex to extract Ip Address from string
        const regexToGetIpAddress = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        const result = task.execSync(this._toolPath, Utility.argStringToArray(this._getArgumentString() +" "+ this._getAdditionalArgument()));
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
