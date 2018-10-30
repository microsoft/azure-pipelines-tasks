import tl = require('vsts-task-lib');
import { TaskParametersUtility, TaskParameters } from '../taskparameters';
import { getMockEndpoint } from '../node_modules/azurermdeploycommon/Tests/mock_utils';

getMockEndpoint();
async function ValidatePostDeploymentInput() {
    let taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
    if(taskParameters.AppSettings.indexOf('-SCM_COMMAND_IDLE_TIMEOUT') != -1) {
        tl.setResult(tl.TaskResult.Succeeded, 'SCM_COMMAND_IDLE_TIMEOUT variable PRESENT');
    }
    else {
        tl.setResult(tl.TaskResult.Failed, 'SCM_COMMAND_IDLE_TIMEOUT variable NOT PRESENT');
    }
}

ValidatePostDeploymentInput();