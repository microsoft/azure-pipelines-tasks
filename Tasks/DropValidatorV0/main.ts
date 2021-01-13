import * as tl from 'azure-pipelines-task-lib/task';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry';
import * as fs from 'fs';

async function run() {
    try {
        const dropValidatorArgs = ['BuildDropPath', 'ManifestPath', 'OutputPath', 'Verbosity', 'ConfigFilePath', 'RootPathFilter'];
        let dropValidator = await getDropValidator();

        dropValidatorArgs.forEach(arg => {
            const inputArgValue = tl.getInput(arg);
            dropValidator = dropValidator.argIf(inputArgValue != null, '-' + arg).argIf(inputArgValue != null, inputArgValue);
        });

        const result = await dropValidator.exec();

        if (result === 0) {
            tl.setResult(tl.TaskResult.Succeeded,  tl.loc('TaskSucceeded'));
        } else {
            tl.setResult(tl.TaskResult.Failed, tl.loc('TaskFailed'));
        }

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    } finally {
        logTelemetry();
    }
}

async function getDropValidator() {
    try {
        // Get dotnet tool
        const dotnetPath = tl.which('dotnet', true);
        const dotnet = tl.tool(dotnetPath);

        // Install or update the dropvalidator tool globally.
        dotnet.line('tool update Microsoft.DropValidator --global');
        const result = await dotnet.exec();
        tl.debug('Result: ' + result);

        if (result === 0) {
            const dropValidatorPath = tl.which('dropvalidator', true);
            return tl.tool(dropValidatorPath);
        }

        throw new Error();
    } catch (err) {
        tl.error(tl.loc('Error_ToolInstallFailed'));
        throw err;
    }
}

function logTelemetry() {
    try {
        const output = fs.readFileSync(tl.getInput('OutputPath', true), 'UTF-8');
        const validatorSummary = JSON.parse(output).Summary;
        telemetry.emitTelemetry('Packaging', 'DropValidatorV0', validatorSummary);
    } catch (err) {
        tl.debug(tl.loc('Error_FailedTelemetry', err));
    }
}
run();