import * as task from 'azure-pipelines-task-lib/task';
import * as qs from 'querystring';
import * as url from 'url';

// interface ICurlProxy {
//     variable: string,
//     setting: string
// }

// function toCurlProxy(proxyCfg: task.ProxyConfiguration): ICurlProxy {
//     const parsedUrl = url.parse(proxyCfg.proxyUrl);
//     const proxyEnvVarName: string = parsedUrl.protocol === 'https:'? "https_proxy" : "http_proxy";

//     let proxyUrl = new URL(proxyCfg.proxyUrl);
//     proxyUrl.username = proxyCfg.proxyUsername || "";
//     proxyUrl.password = proxyCfg.proxyPassword || "";
    
//     let curlProxy: ICurlProxy = {
//         variable: proxyEnvVarName,
//         setting: proxyUrl.toString()
//     };
   
//     return curlProxy;
// }

export function setProxySettings(proxyCfg: task.ProxyConfiguration) {
    // Ruby Net::HTTP uses 'http_proxy' / 'https_proxy`
    if (proxyCfg.proxyUrl) {
        task.debug(`using proxy ${proxyCfg.proxyUrl}`);

        const parsedUrl = url.parse(proxyCfg.proxyUrl);
        const proxyEnvVarName: string = parsedUrl.protocol === 'https:'? "https_proxy" : "http_proxy";

        // let proxy = url.parse(proxyCfg.proxyUrl);
        // proxy.username = proxyCfg.proxyUsername || "";

        // if (proxyCfg.proxyPassword) {
        //     task.setSecret(qs.escape(proxyCfg.proxyPassword));
        //     proxy.password = proxyCfg.proxyPassword;
        // }

        // task.setVariable(proxyEnvVarName, proxy.toString());
    }
}