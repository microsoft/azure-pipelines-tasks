import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as Endpoint from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import { TaskInputsHelper } from './src/inputs';
import fs = require('fs');
import util = require('util');
import { AzureFunctionInvoker } from './src/function-invoker';

async function main() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        tl.debug("Task execution started");
        const inputs = TaskInputsHelper.getInputs();

        const writeFile = util.promisify(fs.writeFile);

        await writeFile('inputs.txt', JSON.stringify(inputs, null, 2));
        tl.debug("Inputs written to inputs.txt");

        const invoker = new AzureFunctionInvoker(inputs);
        const result = await invoker.invoke();

        tl.debug("Function invocation result: " + JSON.stringify(result, null, 2));
    }
    catch(error) {
        tl.debug("Error occurred during task execution: " + error);
        // tl.setResult(tl.TaskResult.Failed, error);
    }
    finally {
        Endpoint.dispose();
    }
}

main();