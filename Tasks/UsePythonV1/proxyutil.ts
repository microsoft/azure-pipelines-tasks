import * as task from 'azure-pipelines-task-lib/task';
import * as qs from 'querystring';

export function setProxySettings(proxyCfg: task.ProxyConfiguration) {
    const proxy = new URL(proxyCfg.proxyUrl);
    const proxyEnvVarName: string = proxy.protocol === 'https:'? "https_proxy" : "http_proxy";

    if (proxyCfg.proxyUsername) {
        proxy.username = proxyCfg.proxyUsername;
    }
    if (proxyCfg.proxyPassword) {
        task.setSecret(qs.escape(proxyCfg.proxyPassword));
        proxy.password = proxyCfg.proxyPassword;
    }

    task.setVariable(proxyEnvVarName, proxy.toString());
}