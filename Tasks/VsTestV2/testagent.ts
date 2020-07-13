import * as tl from 'azure-pipelines-task-lib/task';
import * as webapim from 'vso-node-api/WebApi';
import * as models from './models';

export class TestAgent {
    public static async createAgent(environment: models.DtaEnvironment, retries: number) {
        var currentRetryCount = retries;
        while(currentRetryCount > 0) {
            currentRetryCount--;
            try {
                const envUrlRef: any = { Url: environment.environmentUri };
                const machineNameRef: any = { Name: environment.agentName };
                // TODO : Change any to appropriate types once promiseme package is avialable
                const testAgent: any = {
                                    Name: environment.agentName,
                                    Capabilities: [],
                                    DtlEnvironment: envUrlRef,
                                    DtlMachine: machineNameRef };
                const webapi: any = new webapim.WebApi(environment.tfsCollectionUrl, webapim.getBearerHandler(environment.patToken));
                const testApi: any = webapi.getTestApi();
                const registeredAgent = await testApi.createAgent(testAgent);
                tl.debug('created the test agent entry in DTA service, id : ' + registeredAgent.id);
                return registeredAgent.id;
            } catch (error) {
                tl.error('Error : created the test agent entry in DTA service, so retrying => retries pending  : ' + currentRetryCount
                        + 'error details :' + error);
                if(currentRetryCount === 0) {
                    throw new Error(tl.loc("configureDtaAgentFailed", retries, error));
                }
            }
        }
    }
}