//
// UseNode: 
//     Optionally install version at runtime, setup proxy and setup auth
//     This allows for natural cmd line steps in yaml after "using" that eco-system
//     since proxy vars and auth is setup for the rest of the job
//
// https://github.com/Microsoft/azure-pipelines-yaml/blob/master/design/use-statement.md
//

import * as taskLib from 'azure-pipelines-task-lib/task';
//import * as toolLib from 'vsts-task-tool-lib/tool';
import * as installer from './installer';
import * as proxyutil from './proxyutil';
import * as path from 'path';

async function run() {
    try {
        //
        // Version is optional.  If supplied, install / use from the tool cache
        // If not supplied then task is still used to setup proxy, auth, etc...
        //
        taskLib.setResourcePath(path.join(__dirname, 'task.json'));
        const version = taskLib.getInput('version', false);
        if (version) {
            const checkLatest: boolean = taskLib.getBoolInput('checkLatest', false);
            await installer.getNode(version, checkLatest);
        }

        const proxyCfg: taskLib.ProxyConfiguration = taskLib.getHttpProxyConfiguration();
        if (proxyCfg) {
            proxyutil.setCurlProxySettings(proxyCfg);
        }
    }
    catch (error) {
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

run()