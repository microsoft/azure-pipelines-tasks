//
// UseNode: 
//     Optionally install version at runtime, setup proxy and setup auth
//     This allows for natural cmd line steps in yaml after "using" that eco-system
//     since proxy vars and auth is setup for the rest of the job
//
// https://github.com/Microsoft/azure-pipelines-yaml/blob/master/design/use-statement.md
//

import * as taskLib from 'vsts-task-lib/task';
//import * as toolLib from 'vsts-task-tool-lib/tool';
import * as installer from './installer';
import * as proxyutil from './proxyutil';
import * as restm from 'typed-rest-client/RestClient';
import * as url from 'url';
//import * as os from 'os';
//import * as path from 'path';
import * as qs from 'querystring'

async function run() {
    try {
        //
        // Version is optional.  If supplied, install / use from the tool cache
        // If not supplied then task is still used to setup proxy, auth, etc...
        //
        let versionSpec = taskLib.getInput('version', true);
        if (versionSpec) {
            let checkLatest: boolean = taskLib.getBoolInput('checkLatest', false);

            // TODO: installer doesn't support proxy
            await installer.getNode(versionSpec, checkLatest);
        }

        let proxyCfg: taskLib.ProxyConfiguration = taskLib.getHttpProxyConfiguration();
        if (proxyCfg) {
            proxyutil.setCurlProxySettings(proxyCfg);
        }
        //
        // Setup node / npm proxy variables from the agent proxy config
        //
        // let proxyCfg: taskLib.ProxyConfiguration = taskLib.getHttpProxyConfiguration();
        // if (proxyCfg) {
        //     if (proxyCfg && proxyCfg.proxyUrl) {
        //         taskLib.debug(`using proxy ${proxyCfg.proxyUrl}`);
        //         const parsedUrl = url.parse(proxyCfg.proxyUrl);
        //         const httpEnvVarName: string = parsedUrl.protocol === 'https:'? "HTTPS_PROXY" : "HTTP_PROXY";

        //         let proxyUrl = new URL(proxyCfg.proxyUrl);
        //         proxyUrl.username = proxyCfg.proxyUsername;
        //         proxyUrl.password = proxyCfg.proxyPassword;

        //         // register the escaped versions of password
        //         if (proxyCfg.proxyPassword) {
        //             taskLib.setSecret(qs.escape(proxyCfg.proxyPassword))
        //         }
                
        //         // set the variable available for the rest of the job
        //         taskLib.setVariable(httpEnvVarName, url.toString());
        //     }
        // }

    }
    catch (error) {
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

run()