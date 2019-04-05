import * as tl from 'vsts-task-lib/task';
import * as trm from 'vsts-task-lib/toolrunner';
import * as nuGetGetter from 'packaging-common/nuget/NuGetToolGetter';

export class NuGetInstaller {
    public static async installNuGet(version: string) {
        try {
            console.log(tl.loc("InstallingNuGetVersion", version));
            await nuGetGetter.getNuGet(version, false, true);

            const proxy: tl.ProxyConfiguration = tl.getHttpProxyConfiguration();
            if (proxy) {
                NuGetInstaller.setProxy(proxy);
            }
        }
        catch (error) {
            tl.error(tl.loc("FailureWhileInstallingNuGetVersion", version, error.message));
            tl.setResult(tl.TaskResult.Failed, '');
        }
    }

    private static setProxy(proxyConfig: tl.ProxyConfiguration) {
        const nugetPath = tl.which('nuget');

        console.log(tl.loc("SettingUpNugetProxySettings",
            + proxyConfig.proxyUrl,
            + proxyConfig.proxyUsername,
            + proxyConfig.proxyPassword));
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
}