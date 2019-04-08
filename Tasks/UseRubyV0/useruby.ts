import * as os from "os";
import * as path from "path";
import * as task from "azure-pipelines-task-lib/task";
import { installRubyVersion } from "./installer";
import * as proxyutil from "./proxyutil";

async function run() {
    try {
        const version: string = task.getInput("version", true);
        const architecture: string = task.getInput("architecture", false) || os.arch();

        // Install tool
        if (version) {
            task.setResourcePath(path.join(__dirname, "task.json"));
            await installRubyVersion({
                version,
                architecture
            });
        }

        // Configure proxy
        const proxyCfg: task.ProxyConfiguration = task.getHttpProxyConfiguration();
        if (proxyCfg && proxyCfg.proxyUrl) {
            proxyutil.setProxySettings(proxyCfg);
        }

        task.setResult(task.TaskResult.Succeeded, "");
    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
}

run();
