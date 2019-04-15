import * as path from 'path';
import * as task from 'azure-pipelines-task-lib/task';
import * as tl from 'azure-pipelines-task-lib';
import * as proxyutil from './proxyutil';
import { getPlatform } from './taskutil';
import { usePythonVersion } from './usepythonversion';

(async () => {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        await usePythonVersion({
            version: task.getInput('version', false),
            architecture: task.getInput('architecture', true)
        },
        getPlatform());

        // Always set proxy.
        const proxy: tl.ProxyConfiguration | null = tl.getHttpProxyConfiguration();
        if (proxy) {
            proxyutil.setProxy(proxy);
        }

        task.setResult(task.TaskResult.Succeeded, "");
    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
})();
