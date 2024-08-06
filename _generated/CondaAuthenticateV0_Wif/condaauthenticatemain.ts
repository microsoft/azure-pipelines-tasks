import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { emitTelemetry } from "azure-pipelines-tasks-artifacts-common/telemetry";
import * as url from 'url';
import { getFederatedWorkloadIdentityCredentials, getFeedTenantId } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    let federatedFeedAuthSuccessCount: number = 0;
    try {

        const feedUrl = tl.getInput("feedUrl");
        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");

        if (feedUrl && entraWifServiceConnectionName) {
            if (url.parse(feedUrl))
            {
                tl.debug(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName, feedUrl));
                const feedTenant = await getFeedTenantId(feedUrl);
                let token = await getFederatedWorkloadIdentityCredentials(entraWifServiceConnectionName, feedTenant);
                if (token)
                {
                    tl.debug(tl.loc('AddingAuthRegistry', feedUrl));
                    tl.setVariable('ARTIFACTS_CONDA_TOKEN', token);
                    federatedFeedAuthSuccessCount++;
                    console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", feedUrl));
                } 
                else
                {
                    throw new Error(tl.loc("FailedToGetServiceConnectionAuth", entraWifServiceConnectionName)); 
                }
                return;
            } else {
                throw new Error(tl.loc("Error_FailedToParseFeedUrl", feedUrl));
            }
        }

        const localAccesstoken = tl.getVariable('System.AccessToken');
        tl.debug(tl.loc('AddingAuthChannel', 'ARTIFACTS_CONDA_TOKEN'));
        tl.setVariable('ARTIFACTS_CONDA_TOKEN', localAccesstoken);
        tl.setSecret(localAccesstoken);
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    } finally{
        emitTelemetry("Packaging", "CondaAuthenticateV0", {
            "FederatedFeedAuthCount": federatedFeedAuthSuccessCount
        });
    }
}
main();
