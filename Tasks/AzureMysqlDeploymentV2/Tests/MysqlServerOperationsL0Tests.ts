import { getMockEndpoint, nock, getMockMysqlServers } from './mock_utils';
import * as querystring from 'querystring';
import tl = require('azure-pipelines-task-lib');
import { MysqlServerOperations } from '../operations/MysqlServerOperations';
import { MysqlServer } from '../models/MysqlServer';
var endpoint = getMockEndpoint();
getMockMysqlServers();

export class MysqlServerOperationsL0Tests  {

    public static mysqlServerOperations: MysqlServerOperations = new MysqlServerOperations(endpoint.applicationTokenCredentials, endpoint.subscriptionID);

    public static async getMysqlServerFromServerName() {
        await MysqlServerOperationsL0Tests.testForCorrectId();
        await MysqlServerOperationsL0Tests.testWithoutId();
        await MysqlServerOperationsL0Tests.testForInvalidId();
        await MysqlServerOperationsL0Tests.testForNotFound();
    }

    public static async testForCorrectId(){
        try{
            const mysqlServer: MysqlServer = await MysqlServerOperationsL0Tests.getServerDeatils("testserver.test-vm1.onebox.xdb.mscds.com");
            tl.setResult(tl.TaskResult.Succeeded, 'MysqlServerOperationsTests.MysqlServerFromServerName should has passed.');
        }catch(error){
            tl.setResult(tl.TaskResult.Failed, 'MysqlServerOperationsTests.MysqlServerFromServerName should have passed but failed.');
        }
    }
    
    public static async testWithoutId(){
        try{
            const mysqlServer: MysqlServer = await MysqlServerOperationsL0Tests.getServerDeatils("serverWithoutId.test-vm1.onebox.xdb.mscds.com");
            tl.setResult(tl.TaskResult.Succeeded, 'MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to without id in mysql server but passed .');
        }catch(error){
            tl.setResult(tl.TaskResult.Failed, 'MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to without id in mysql server.');
        }
    }

    public static async testForInvalidId(){
        try{
            const mysqlServer: MysqlServer = await MysqlServerOperationsL0Tests.getServerDeatils("serverWithInvalidId.test-vm1.onebox.xdb.mscds.com");
            tl.setResult(tl.TaskResult.Succeeded, 'MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid id in mysql server but passed.');
        }catch(error){
            tl.setResult(tl.TaskResult.Failed, 'MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid id in mysql server.');
        }
    }

    public static async testForNotFound(){
        try{
            const mysqlServer: MysqlServer = await MysqlServerOperationsL0Tests.getServerDeatils("serverNotFound.test-vm1.onebox.xdb.mscds.com");
            if(mysqlServer){
                tl.setResult(tl.TaskResult.Succeeded, 'MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid mysql server name but passed.');
            }else{
                tl.setResult(tl.TaskResult.Failed, 'MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid mysql server name.');
            }
       }catch(error){
           tl.setResult(tl.TaskResult.Failed, 'MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid mysql server name.');
       }
    }

    public static async getServerDeatils(serverName: string){
        const mysqlServer: MysqlServer = await MysqlServerOperationsL0Tests.mysqlServerOperations.getMysqlServerFromServerName(serverName);
        return mysqlServer;
    }

}

MysqlServerOperationsL0Tests.getMysqlServerFromServerName();
