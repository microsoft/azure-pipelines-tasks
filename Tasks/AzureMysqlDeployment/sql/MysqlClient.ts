import { ISqlClient } from './ISqlClient';
import { FirewallConfigurationCheckResult } from '../models//FirewallConfigurationCheckResult';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import task = require("vsts-task-lib/task");
import Q = require('q');

export class MysqlClient implements ISqlClient {
    private _azureMysqlTaskParameter: AzureMysqlTaskParameter;
    private _hostName: string;
    private _toolPath: string;

    constructor(azureMysqlTaskParameter: AzureMysqlTaskParameter, serverName: string, toolPath: string) {
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
    }

    /**
     * Get Firewall configuration related to agent box
     */
    public getFirewallConfiguration(): FirewallConfigurationCheckResult {
        let firewallConfigurationCheckReult: FirewallConfigurationCheckResult = new FirewallConfigurationCheckResult(true);
        // Regex to extract Ip Address from string
        const regexToGetIpAddress = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        const result = task.execSync(this._toolPath, this._getArgumentString());
        task.debug('Mysql server connection check result: '+JSON.stringify(result));
        // If agent is not whitelisted it will throw error with ip address 
        if(result && result.stderr){
            var ipAddresses = result.stderr.match(regexToGetIpAddress);
            if(ipAddresses && ipAddresses.length > 0){
                firewallConfigurationCheckReult = new FirewallConfigurationCheckResult(false, ipAddresses[0]);         
            }
        }
        return firewallConfigurationCheckReult;
    }

    /**
     * Get the connection argument for mysql
     */
    private _getArgumentString(): string{
        let argumentString = "-h" + this._hostName + " -u" + this._azureMysqlTaskParameter.getSqlUserName() + " -p" + this._azureMysqlTaskParameter.getSqlPassword();
        argumentString += this._azureMysqlTaskParameter.getDatabaseName() ? " -d" + this._azureMysqlTaskParameter.getDatabaseName() : "";
        return argumentString;
    }

    /**
     * Execute Mysql script
     */
    public async executeSqlCommand() : Promise<number> {
        let defer = Q.defer<number>();
        task.debug('Started execution of mysql script');
        let argument: string = this._getArgumentString() + this._getFileSourceArgument() + this._getAdditionalArgument();
        task.exec(this._toolPath, argument).then((resultCode)=>{
            task.debug('Script execution on mysql server result: '+JSON.stringify(resultCode));
            if(resultCode === 0){
                defer.resolve(resultCode);
            }else{
                defer.reject(new Error(task.loc("SqlExecutionException")));
            }
        },(error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    /**
     * Additional connection argument passed by user
     */
    private _getAdditionalArgument() : string{
        let additionalArguments: string = ""
        additionalArguments = this._azureMysqlTaskParameter.getTaskNameSelector() === 'InlineSqlTask' ?
            this._azureMysqlTaskParameter.getSqlAdditionalArguments() : 
            this._azureMysqlTaskParameter.getInlineAdditionalArguments();
        return additionalArguments = additionalArguments ? additionalArguments : "";
    }

    /**
     * Get connection argument to run script from file or inline
     */
    private _getFileSourceArgument() : string{
        return this._azureMysqlTaskParameter.getTaskNameSelector() === 'InlineSqlTask' ? 
            " -e" + "\"" + this._azureMysqlTaskParameter.getSqlInline() + "\"" : 
            " -e" + "\" source " + this._azureMysqlTaskParameter.getSqlFile() + "\"";
    }
}
