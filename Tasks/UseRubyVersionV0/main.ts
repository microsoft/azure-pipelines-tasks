import * as path from 'path';
import * as task from 'azure-pipelines-task-lib/task';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry'
import { useRubyVersion, getPlatform } from './userubyversion';

(async () => {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        const versionSpec = task.getInput('versionSpec', true) || '';
        const addToPath = task.getBoolInput('addToPath', true);
        await useRubyVersion({
            versionSpec,
            addToPath
        }, getPlatform());
        task.setResult(task.TaskResult.Succeeded, '');
        telemetry.emitTelemetry('TaskHub', 'UseRubyVersionV0', {
            versionSpec,
            addToPath
        });
    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
})();
