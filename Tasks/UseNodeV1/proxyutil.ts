import * as taskLib from 'azure-pipelines-task-lib/task';
import * as qs from 'querystring';
import * as url from 'url';

interface ICurlProxy {
    variable: string,
    setting: string
}

function toCurlProxy(proxyCfg: taskLib.ProxyConfiguration): ICurlProxy | null {
    let curlProxy: ICurlProxy | null;
    if (proxyCfg) {
        if (proxyCfg.proxyUrl) {
            taskLib.debug(`using proxy ${proxyCfg.proxyUrl}`);
            const parsedUrl = url.parse(proxyCfg.proxyUrl);
            const httpEnvVarName: string = parsedUrl.protocol === 'https:'? "HTTPS_PROXY" : "HTTP_PROXY";

            let proxyUrl = new URL(proxyCfg.proxyUrl);
            proxyUrl.username = proxyCfg.proxyUsername;
            proxyUrl.password = proxyCfg.proxyPassword;
            
            curlProxy = <ICurlProxy>{};
            curlProxy.variable = httpEnvVarName;
            curlProxy.setting = proxyUrl.toString();
        }
    } 
    
    return curlProxy;
}

export function setCurlProxySettings(proxyConfig: taskLib.ProxyConfiguration) {
    if (taskLib.getVariable("HTTP_PROXY") || taskLib.getVariable("HTTPS_PROXY")) {
        // Short circuit if proxy already set.
        return;
    }
    let curlProxy: ICurlProxy | null = toCurlProxy(proxyConfig);
    if (curlProxy) {
        // register the escaped versions of password
        if (proxyConfig.proxyPassword) {
            taskLib.setSecret(qs.escape(proxyConfig.proxyPassword))
        }

        taskLib.setVariable(curlProxy.variable, curlProxy.setting);   
    }
}
