import tl = require('azure-pipelines-task-lib');
import { TaskParametersUtility, TaskParameters } from '../operations/TaskParameters';
import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';

getMockEndpoint();
function ValidatePostDeploymentInput() {
    let taskParameters: TaskParameters = TaskParametersUtility.getParameters();
    if(taskParameters.AppSettings.indexOf('-SCM_COMMAND_IDLE_TIMEOUT') != -1) {
        tl.setResult(tl.TaskResult.Succeeded, 'SCM_COMMAND_IDLE_TIMEOUT variable PRESENT');
    }
    else {
        tl.setResult(tl.TaskResult.Failed, 'SCM_COMMAND_IDLE_TIMEOUT variable NOT PRESENT');
    }
}

ValidatePostDeploymentInput();