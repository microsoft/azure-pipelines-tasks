import * as tl from 'azure-pipelines-task-lib/task';
import { DotnetCoreInstaller} from './installer';
import * as proxyutil from './proxyutil';
import * as path from 'path';

async function run() {
    let packageType = tl.getInput('packageType') || 'sdk';
    const version: string = tl.getInput('version');
    if (version) {
        console.log(tl.loc("ToolToInstall", packageType, version));
        const installer: DotnetCoreInstaller = new DotnetCoreInstaller(packageType, version);
        await installer.install();
        const nugetVersion = tl.getInput('nugetVersion') || '3.3.0';
        await installer.installNuGet(nugetVersion);
    }

    const proxy: tl.ProxyConfiguration = tl.getHttpProxyConfiguration();
    if (proxy) {
        proxyutil.setProxy(proxy);
    }
}

const taskManifestPath = path.join(__dirname, "task.json");
tl.debug("Setting resource path to " + taskManifestPath);
tl.setResourcePath(taskManifestPath);

run()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));