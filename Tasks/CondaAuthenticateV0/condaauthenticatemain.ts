import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    try {
        const localAccesstoken = tl.getVariable('System.AccessToken');
        tl.debug(tl.loc('AddingAuthChannel', 'ARTIFACTS_CONDA_TOKEN'));
        tl.setVariable('ARTIFACTS_CONDA_TOKEN', localAccesstoken);
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    }
}
main();