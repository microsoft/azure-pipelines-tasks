import { ISqlClient } from './ISqlClient';
import { FirewallConfiguration } from '../models/FirewallConfiguration';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { Utility } from '../operations/MysqlUtiliy';
import * as telemetry from '../telemetry';
import task = require("azure-pipelines-task-lib/task");
var packageUtility = require('azure-pipelines-tasks-webdeployment-common/packageUtility.js');
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
     * Get the connection argument for mysql
     */
    private _getArgumentString(): string{
        let argumentString = "-h" + this._hostName + " -u" + this._azureMysqlTaskParameter.getSqlUserName() + " -p" + this._azureMysqlTaskParameter.getSqlPassword();
        return argumentString;
    }

    /**
     * Execute Mysql script
     */
    public async executeSqlCommand() : Promise<number> {
        let defer = Q.defer<number>();
        let argument: string = this._getArgumentString() +" "+ this._getAdditionalArgument();
        let additionalArgumentTelemtry = {additionalArguments: Utility.getAdditionalArgumentForTelemtry(this._getAdditionalArgument())};
        telemetry.emitTelemetry('TaskHub', 'AzureMysqlDeployment', additionalArgumentTelemtry); 
        if(this._azureMysqlTaskParameter.getDatabaseName()){
            // Creating databse if it doesn't exist 
            this._executeSqlScript(argument + this._createDatabaseScriptIfItDoesnotExist()).then((resultCode)=>{
                argument += this._azureMysqlTaskParameter.getDatabaseName() ? " -D" + this._azureMysqlTaskParameter.getDatabaseName() : "";
                // Running sql script passes by user
                this._executeSqlScript(argument + this._getFileSourceArgument()).then((resultCode)=>{
                    defer.resolve(resultCode);
                },(error) => {
                    defer.reject(error);
                });
            }).catch((error) => {
                defer.reject(error);
            });
        }else{
            argument += this._azureMysqlTaskParameter.getDatabaseName() ? " -D" + this._azureMysqlTaskParameter.getDatabaseName() : "";
            this._executeSqlScript(argument + this._getFileSourceArgument()).then((resultCode)=>{
                defer.resolve(resultCode);
            },(error) => {
                defer.reject(error);
            });
        }

        return defer.promise;
    }

    private _createDatabaseScriptIfItDoesnotExist() : string {
        return " -e" + '"' + "CREATE DATABASE IF NOT EXISTS `" + this._azureMysqlTaskParameter.getDatabaseName() + "` ; "  + '"' ;
    } 

    private async _executeSqlScript(argument: string): Promise<number> {
        let defer = Q.defer<number>();
        task.debug('Started execution of mysql script');
        task.exec(this._toolPath, Utility.argStringToArray(argument)).then((resultCode)=>{
            task.debug('Script execution on mysql server result: '+ resultCode);
            if(resultCode === 0){
                defer.resolve(resultCode);
            }else{
                defer.reject(new Error(task.loc("SqlExecutionException", resultCode)));
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
        return this._azureMysqlTaskParameter.getSqlAdditionalArguments() ? this._azureMysqlTaskParameter.getSqlAdditionalArguments() : " ";
    }

    /**
     * Get connection argument to run script from file or inline
     */
    private _getFileSourceArgument() : string {
        let  fileSourceArgument ;
        if( this._azureMysqlTaskParameter.getTaskNameSelector() === 'InlineSqlTask' ) {
            fileSourceArgument = " -e" + '"' + this._azureMysqlTaskParameter.getSqlInline() + '"';
        }
        else {
            fileSourceArgument = ` -e "source ${packageUtility.PackageUtility.getPackagePath(this._azureMysqlTaskParameter.getSqlFile()).replace(/\\/g, '/')};"`;
        }
       
        return  fileSourceArgument;       
    }
}
