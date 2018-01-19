import tl = require('vsts-task-lib/task');
import { AzureMysqlManagementClient } from 'azure-arm-rest/azure-arm-mysql';
import { AzureMysqlTaskParameter } from '../models/AzureMysqlTaskParameter';
import { ApplicationTokenCredentials} from 'azure-arm-rest/azure-arm-common';
import { MysqlServer } from '../models/MysqlServer';
import Q = require('q');

export class MysqlServerOperations{

    private _azureMysqManagementClient: AzureMysqlManagementClient;

    constructor(azureCredentials: ApplicationTokenCredentials, subscriptionId: string) {
        this._azureMysqManagementClient = new AzureMysqlManagementClient(azureCredentials, subscriptionId);
    }

    public async getMysqlServerFromServerName(serverName: string): Promise<MysqlServer> {
        let defer = Q.defer<MysqlServer>();
        this._azureMysqManagementClient.mysqlServers.list((error, result, request, response) => {
            if(error){
                throw new Error(tl.loc("NotAbleToGetAllServers"));
            }else{
                defer.resolve(this._getMysqlServerFromResponse(result, serverName));   
            }
        });
        return defer.promise;
    }

    private _getMysqlServerFromResponse(result: any, serverName: string) : MysqlServer{
        let mysqlServer: MysqlServer;
        if(result){
            result.forEach((resultObject) => {
                if(resultObject.name === serverName){
                    const pathArray =resultObject.id.split("/");
                    mysqlServer = new MysqlServer(resultObject.name, resultObject.properties.fullyQualifiedDomainName, this._getResourceGroupNameFromUrl(resultObject.id));
                }
            });
        }
        return mysqlServer;
    }

    private _getResourceGroupNameFromUrl(id: string){
        if(!id){
            throw new Error(tl.loc("UnableToFindResourceGroupDueToNullId"));
        }
        const pathArray =id.split("/");
        return pathArray[4];
    }

}