import tl = require('azure-pipelines-task-lib');
import { TaskParametersUtility, TaskParameters } from '../operations/TaskParameters';

function ValidatePostDeploymentInput() {
    try {
        let taskParameters: TaskParameters = TaskParametersUtility.getParameters();
        if (taskParameters.AppSettings.indexOf('-SCM_COMMAND_IDLE_TIMEOUT') != -1) {
            tl.setResult(tl.TaskResult.Succeeded, 'SCM_COMMAND_IDLE_TIMEOUT variable PRESENT');
        }
        else {
            tl.setResult(tl.TaskResult.Failed, 'SCM_COMMAND_IDLE_TIMEOUT variable NOT PRESENT');
        }
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
    }
}

async function ValidateMsBuildPackage() {
    try {
        let taskParameters: TaskParameters = TaskParametersUtility.getParameters();
        const isMsBuildType = await taskParameters.Package.isMSBuildPackage();
        if (isMsBuildType) {
            tl.setResult(tl.TaskResult.Succeeded, 'msbuild package PRESENT');
        }
        else {
            tl.setResult(tl.TaskResult.Failed, 'msbuild package NOT PRESENT');
        }
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
    }
}

ValidatePostDeploymentInput();
ValidateMsBuildPackage();