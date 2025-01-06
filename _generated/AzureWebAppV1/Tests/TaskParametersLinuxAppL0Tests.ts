import tl = require('azure-pipelines-task-lib');
import { TaskParametersUtility, TaskParameters } from '../taskparameters';

async function ValidateMsBuildPackage() {
    try {
        let taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
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

ValidateMsBuildPackage();