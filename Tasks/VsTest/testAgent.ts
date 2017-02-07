import * as tl from 'vsts-task-lib/task';
import * as webapim from 'vso-node-api/WebApi';
import * as testapim from 'vso-node-api/TestApi';
import * as testInterfaces from 'vso-node-api/interfaces/TestInterfaces'
import * as models from './models';

export class TestAgent {
    public static async createAgent(environment: models.DtaEnvironment, retries: number) : number {
        while(retries > 0) {
            retries--;
            try {
                const testAgentName: string = tl.getVariable('Agent.MachineName');
                const envUrlRef: any = { Url: environment.environmentUri };
                const machineNameRef = { Name: testAgentName };
                // TODO : Change any to appropriate types once promiseme package is avialable
                const testAgent: any = {
                                    Name: testAgentName,
                                    Capabilities: [],
                                    DtlEnvironment: envUrlRef,
                                    DtlMachine: machineNameRef };
                const webapi: any = new webapim.WebApi(environment.tfsCollectionUrl, webapim.getBearerHandler(environment.patToken));
                const testApi: any = webapi.getTestApi();
                const registeredAgent = await testApi.createAgent(testAgent);
                tl.debug('created the test agent entry in DTA service, id : ' + registeredAgent.id);
                return registeredAgent.id;
            } catch (error) {
                tl.error('Error : created the test agent entry in DTA service, so retrying => retries pending  : ' + retries);
                if(retries === 0) {
                    throw error;
                }
            }
        }
    }
}