import * as path from "path";
import * as task from "azure-pipelines-task-lib/task";
import * as tool from "azure-pipelines-tool-lib/tool"
import { installRubyVersion } from "./installer";
import * as proxyutil from "./proxyutil";

async function run() {
    try {
        const version = task.getInput("version", true);

        // Install tool
        if (version) {
            task.setResourcePath(path.join(__dirname, "task.json"));
            await installRubyVersion({
                version
            });
        }

        // Configure proxy
        const proxyCfg: task.ProxyConfiguration = task.getHttpProxyConfiguration();
        if (proxyCfg) {
            proxyutil.setProxySettings(proxyCfg);
        }

        task.setResult(task.TaskResult.Succeeded, "");
    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
}

run();
