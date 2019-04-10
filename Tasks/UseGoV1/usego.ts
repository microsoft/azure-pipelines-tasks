import * as tl from 'azure-pipelines-task-lib/task';
import * as proxyutil from './proxyutil';
import * as installer from './installer';

async function run() {
    try {
        let version = tl.getInput('version', false);
        if (version) {
            await installer.getGo(version.trim());
        }

        // Note - proxy will not work with go get since that is done through source control providers.
        const proxyCfg: tl.ProxyConfiguration = tl.getHttpProxyConfiguration();
        if (proxyCfg) {
            proxyutil.setCurlProxySettings(proxyCfg);
        }
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

run();