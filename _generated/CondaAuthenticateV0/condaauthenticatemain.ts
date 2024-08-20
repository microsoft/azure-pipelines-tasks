import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { emitTelemetry } from "azure-pipelines-tasks-artifacts-common/telemetry";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    let federatedFeedAuthSuccessCount: number = 0;
    try {


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
