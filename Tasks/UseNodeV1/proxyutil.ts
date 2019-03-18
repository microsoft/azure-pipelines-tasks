import * as taskLib from 'vsts-task-lib/task';
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
            const httpEnvVarName: string = parsedUrl.protocol === 'https:'? "https_proxy" : "http_proxy";

            let proxyUrl = new URL(proxyCfg.proxyUrl);
            proxyUrl.username = proxyCfg.proxyUsername;
            proxyUrl.password = proxyCfg.proxyPassword;
            
            curlProxy = <ICurlProxy>{};
            curlProxy.variable = httpEnvVarName;
            curlProxy.setting = url.toString();
        }
    } 
    
    return curlProxy;
}

export function setCurlProxySettings(proxyConfig: taskLib.ProxyConfiguration) {
    let curlProxy: ICurlProxy = toCurlProxy(proxyConfig);
    if (curlProxy) {
        taskLib.setVariable(curlProxy.variable, curlProxy.setting);

        // register the escaped versions of password
        if (proxyConfig.proxyPassword) {
            taskLib.setSecret(qs.escape(proxyConfig.proxyPassword))
        }        
    }
}