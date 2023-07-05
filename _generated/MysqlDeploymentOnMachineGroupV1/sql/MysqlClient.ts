import { ISqlClient } from './ISqlClient';

import { MysqlTaskParameter } from '../models/MysqlTaskParameter';
import { Utility } from '../operations/MysqlUtiliy';
import task = require("azure-pipelines-task-lib/task");
var packageUtility = require('azure-pipelines-tasks-webdeployment-common/packageUtility.js');
import Q = require('q');

export class MysqlClient implements ISqlClient {
    private _mysqlTaskParameter: MysqlTaskParameter;
    private _hostName: string;
    private _toolPath: string;

    constructor(mysqlTaskParameter: MysqlTaskParameter, toolPath: string) {
        if (!mysqlTaskParameter) {
            throw new Error(task.loc("MysqlTaskParameterCannotBeEmpty"));
        }
        if (!mysqlTaskParameter.getServerName() || typeof mysqlTaskParameter.getServerName().valueOf() !== 'string') {
            throw new Error(task.loc("MysqlServerNameCannotBeEmpty"));
        }
        if (!toolPath ||typeof toolPath.valueOf() !== 'string') {
            throw new Error(task.loc("ToolPathCannotBeNull"));
        }

        this._mysqlTaskParameter = mysqlTaskParameter;
        this._hostName = mysqlTaskParameter.getServerName();
        this._toolPath = toolPath;
    }

    /**
     * Get the connection argument for mysql
     */
    private _getArgumentString(): string{
        let argumentString = "-h" + this._hostName + " -u" + this._mysqlTaskParameter.getSqlUserName() + " -p" + this._mysqlTaskParameter.getSqlPassword();
        return argumentString;
    }

    /**
     * Execute Mysql script
     */
    public async executeSqlCommand() : Promise<number> {
        let defer = Q.defer<number>();
        let argument: string = this._getArgumentString() +" "+ this._getAdditionalArgument();
        if(this._mysqlTaskParameter.getDatabaseName()){
            // Creating databse if it doesn't exist 
            this._executeSqlScript(argument + this._createDatabaseScriptIfItDoesnotExist()).then((resultCode)=>{
                argument += this._mysqlTaskParameter.getDatabaseName() ? " -D" + this._mysqlTaskParameter.getDatabaseName() : "";
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
            argument += this._mysqlTaskParameter.getDatabaseName() ? " -D" + this._mysqlTaskParameter.getDatabaseName() : "";
            this._executeSqlScript(argument + this._getFileSourceArgument()).then((resultCode)=>{
                defer.resolve(resultCode);
            },(error) => {
                defer.reject(error);
            });
        }

        return defer.promise;
    }

    private _createDatabaseScriptIfItDoesnotExist() : string {
        return " -e" + '"' + "CREATE DATABASE IF NOT EXISTS `" + this._mysqlTaskParameter.getDatabaseName() + "` ; "  + '"' ;
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
        return this._mysqlTaskParameter.getSqlAdditionalArguments() ? this._mysqlTaskParameter.getSqlAdditionalArguments() : " ";
    }

    /**
     * Get connection argument to run script from file or inline
     */
    private _getFileSourceArgument() : string {
        let  fileSourceArgument ;
        if( this._mysqlTaskParameter.getTaskNameSelector() === 'InlineSqlTask' ) {
            fileSourceArgument = " -e" + '"' + this._mysqlTaskParameter.getSqlInline() + '"';
        }
        else {
            fileSourceArgument = " -e" + '" source ' + packageUtility.PackageUtility.getPackagePath(this._mysqlTaskParameter.getSqlFile()) + '"';
        }
       
        return  fileSourceArgument;       
    }
}
