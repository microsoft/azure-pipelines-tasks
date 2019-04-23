import * as tl from 'azure-pipelines-task-lib/task';
import * as trm from 'azure-pipelines-task-lib/toolrunner';

export function setProxy(proxyConfig: tl.ProxyConfiguration) {
    const nugetPath = tl.which('nuget');

    // Set proxy url
    let nuget = tl.tool(nugetPath);
    nuget.arg('config');
    nuget.arg('-set');
    nuget.arg('http_proxy=' + proxyConfig.proxyUrl);
    nuget.exec({} as trm.IExecOptions);

    // Set proxy username
    nuget = tl.tool(nugetPath);
    nuget.arg('config');
    nuget.arg('-set');
    nuget.arg('http_proxy.user=' + proxyConfig.proxyUsername);
    nuget.exec({} as trm.IExecOptions);

    // Set proxy password
    nuget = tl.tool(nugetPath);
    nuget.arg('config');
    nuget.arg('-set');
    nuget.arg('http_proxy.password=' + proxyConfig.proxyPassword);
    nuget.exec({} as trm.IExecOptions);
}