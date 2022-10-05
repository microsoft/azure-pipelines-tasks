"use strict";
import * as tl from 'azure-pipelines-task-lib/task';
import * as trm from 'azure-pipelines-task-lib/toolrunner';
import * as nuGetGetter from 'azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter';

 export class NuGetInstaller {
    public static async installNuGet(version: string) {
        try {
            const proxy: tl.ProxyConfiguration = tl.getHttpProxyConfiguration();
            if (proxy) {
                console.log(tl.loc("InstallingNuGetVersion", version));
                await nuGetGetter.getNuGet(version, false, true);
                NuGetInstaller.setProxy(proxy);
            }
        }
        catch (error) {
            console.warn(tl.loc("FailureWhileInstallingNuGetVersion", version, error.message));
        }
    }

     private static setProxy(proxyConfig: tl.ProxyConfiguration) {
        const nugetPath = tl.which('nuget');

         console.log(tl.loc("SettingUpNugetProxySettings"));
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

         // Set no_proxy
         if(proxyConfig.proxyBypassHosts) {
            nuget = tl.tool(nugetPath);
            nuget.arg('config');
            nuget.arg('-set');
            nuget.arg('no_proxy=' + proxyConfig.proxyBypassHosts.join(','));
            nuget.exec({} as trm.IExecOptions);    
         }
    }
}