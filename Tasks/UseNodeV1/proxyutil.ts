import * as taskLib from 'azure-pipelines-task-lib/task';
import * as qs from 'querystring';
import * as url from 'url';

interface ICurlProxy {
    variable: string,
    setting: string
}

function toCurlProxy(proxyCfg: taskLib.ProxyConfiguration): ICurlProxy {
    let curlProxy: ICurlProxy;
    if (proxyCfg) {
        if (proxyCfg && proxyCfg.proxyUrl) {
            taskLib.debug(`using proxy ${proxyCfg.proxyUrl}`);
            const parsedUrl = url.parse(proxyCfg.proxyUrl);
            const httpEnvVarName: string = parsedUrl.protocol === 'https:'? "HTTPS_PROXY" : "HTTP_PROXY";
            taskLib.debug(`using proxy2 ${proxyCfg.proxyUrl}`);

            let proxyUrl = new URL(proxyCfg.proxyUrl);
            proxyUrl.username = proxyCfg.proxyUsername;
            proxyUrl.password = proxyCfg.proxyPassword;
            taskLib.debug(`using proxy3 ${proxyCfg.proxyUrl}`);
            
            curlProxy = <ICurlProxy>{};
            curlProxy.variable = httpEnvVarName;
            curlProxy.setting = url.toString();
            taskLib.debug(`using proxy4 ${proxyCfg.proxyUrl}`);
        }
    } 
    
    return curlProxy;
}

export function setCurlProxySettings(proxyConfig: taskLib.ProxyConfiguration) {
    if (taskLib.getVariable("HTTP_PROXY") || taskLib.getVariable("HTTPS_PROXY")) {
        // Short circuit if proxy already set.
        return;
    }
    let curlProxy: ICurlProxy = toCurlProxy(proxyConfig);
    if (curlProxy) {
        // register the escaped versions of password
        if (proxyConfig.proxyPassword) {
            taskLib.setSecret(qs.escape(proxyConfig.proxyPassword))
        }

        taskLib.setVariable(curlProxy.variable, curlProxy.setting);   
    }
}