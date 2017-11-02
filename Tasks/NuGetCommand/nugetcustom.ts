import * as tl from "vsts-task-lib/task";
import * as ngToolRunner from "nuget-task-common/NuGetToolRunner2";
import * as nutil from "nuget-task-common/Utility";
import * as path from "path";
import * as auth from "nuget-task-common/Authentication";

import locationHelpers = require("nuget-task-common/LocationHelpers");
import nuGetGetter = require("nuget-task-common/NuGetToolGetter");
import peParser = require('nuget-task-common/pe-parser/index');
import {IExecSyncResult} from "vsts-task-lib/toolrunner";

class NuGetExecutionOptions {
    constructor(
        public nuGetPath: string,
        public environment: ngToolRunner.NuGetEnvironmentSettings,
        public args: string,
        public authInfo: auth.NuGetExtendedAuthInfo
    ) { }
}

export async function run(nuGetPath: string): Promise<void> {
    nutil.setConsoleCodePage();

    let buildIdentityDisplayName: string = null;
    let buildIdentityAccount: string = null;

    let args: string = tl.getInput("arguments", false);

    const version = await peParser.getFileVersionInfoAsync(nuGetPath);
    if(version.productVersion.a < 3 || (version.productVersion.a <= 3 && version.productVersion.b < 5))
    {
        tl.setResult(tl.TaskResult.Failed, tl.loc("Info_NuGetSupportedAfter3_5", version.strings.ProductVersion));
        return;
    }

    try {
        let credProviderPath = nutil.locateCredentialProvider();

        // Clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
        // is unconditionally displayed
        const quirks = await ngToolRunner.getNuGetQuirksAsync(nuGetPath);
        const useCredProvider = ngToolRunner.isCredentialProviderEnabled(quirks) && credProviderPath;
        // useCredConfig not placed here: This task will only support NuGet versions >= 3.5.0 which support credProvider both hosted and OnPrem

        let accessToken = auth.getSystemAccessToken();
        let serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
        let urlPrefixes = await locationHelpers.assumeNuGetUriPrefixes(serviceUri);
        tl.debug(`Discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        let testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
            tl.debug(`All URL prefixes: ${urlPrefixes}`);
        }
        let authInfo = new auth.NuGetExtendedAuthInfo(new auth.InternalAuthInfo(urlPrefixes, accessToken, useCredProvider, false), []);
        let environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            credProviderFolder: useCredProvider ? path.dirname(credProviderPath) : null,
            extensionsDisabled: true
        };

        let executionOptions = new NuGetExecutionOptions(
            nuGetPath,
            environmentSettings,
            args,
            authInfo);

        runNuGet(executionOptions);
    } catch (err) {
        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, "");
    }
}

function runNuGet(executionOptions: NuGetExecutionOptions): IExecSyncResult {
    let nugetTool = ngToolRunner.createNuGetToolRunner(executionOptions.nuGetPath, executionOptions.environment, executionOptions.authInfo);
    nugetTool.line(executionOptions.args);
    nugetTool.arg("-NonInteractive");

    return nugetTool.execSync();
}
