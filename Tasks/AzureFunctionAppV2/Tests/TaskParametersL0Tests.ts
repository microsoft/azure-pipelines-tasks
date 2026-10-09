import tl = require('azure-pipelines-task-lib');
import * as assert from 'assert';
import { TaskParametersUtility, TaskParameters } from '../taskparameters';

async function ValidateTaskParameters() {
    try {
        let taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
        assert.strictEqual(taskParameters.WebAppName, 'mytestfunctionapp');
        console.log('TASK_PARAMS_VALID');
        assert.strictEqual(taskParameters.connectedServiceName, 'AzureRMSpn');
        console.log('CONNECTION_VALID');
        tl.setResult(tl.TaskResult.Succeeded, 'Task parameters validated successfully');
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
    }
}

ValidateTaskParameters();
