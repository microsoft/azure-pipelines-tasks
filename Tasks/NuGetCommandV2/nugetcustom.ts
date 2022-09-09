import * as auth from "azure-pipelines-tasks-packaging-common-v3/nuget/Authentication";
import * as ngToolRunner from "azure-pipelines-tasks-packaging-common-v3/nuget/NuGetToolRunner2";
import * as nutil from "azure-pipelines-tasks-packaging-common-v3/nuget/Utility";
import * as tl from "azure-pipelines-task-lib/task";
import { logError } from 'azure-pipelines-tasks-packaging-common-v3/util';

import peParser = require("azure-pipelines-tasks-packaging-common-v3/pe-parser/index");
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common-v3/locationUtilities";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import {IExecSyncResult} from "azure-pipelines-task-lib/toolrunner";

class NuGetExecutionOptions {
    constructor(
        public nuGetPath: string,
        public environment: ngToolRunner.NuGetEnvironmentSettings,
        public args: string,
        public authInfo: auth.NuGetExtendedAuthInfo
    ) { }
}

export async function run(nuGetPath: string): Promise<void> {
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.NuGet);
    } catch (error) {
        tl.debug("Unable to get packaging URIs");
        logError(error);
        throw error;
    }

    nutil.setConsoleCodePage();

    const buildIdentityDisplayName: string = null;
    const buildIdentityAccount: string = null;

    const args: string = tl.getInput("arguments", false);

    const version = await peParser.getFileVersionInfoAsync(nuGetPath);
    if(version.productVersion.a < 3 || (version.productVersion.a <= 3 && version.productVersion.b < 5))
    {
        tl.setResult(tl.TaskResult.Failed, tl.loc("Info_NuGetSupportedAfter3_5", version.strings.ProductVersion));
        return;
    }

    try {
        // Clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
        // is unconditionally displayed
        const quirks = await ngToolRunner.getNuGetQuirksAsync(nuGetPath);
        const useV1CredProvider: boolean = ngToolRunner.isCredentialProviderEnabled(quirks);
        const useV2CredProvider: boolean = ngToolRunner.isCredentialProviderV2Enabled(quirks);
        const credProviderPath: string = nutil.locateCredentialProvider(useV2CredProvider);
        // useCredConfig not placed here: This task will only support NuGet versions >= 3.5.0
        // which support credProvider both hosted and OnPrem

        const accessToken = pkgLocationUtils.getSystemAccessToken();
        let urlPrefixes = packagingLocation.PackagingUris;
        tl.debug(`Discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        const testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
            tl.debug(`All URL prefixes: ${urlPrefixes}`);
        }
        const authInfo = new auth.NuGetExtendedAuthInfo(
            new auth.InternalAuthInfo(
                urlPrefixes,
                accessToken,
                ((useV1CredProvider || useV2CredProvider) ? credProviderPath : null),
                false),
            []);

        const environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            credProviderFolder: useV2CredProvider === false ? credProviderPath : null,
            V2CredProviderPath: useV2CredProvider === true ? credProviderPath : null,
            extensionsDisabled: true,
        };

        const executionOptions = new NuGetExecutionOptions(
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
    const nugetTool = ngToolRunner.createNuGetToolRunner(
        executionOptions.nuGetPath,
        executionOptions.environment,
        executionOptions.authInfo);
    nugetTool.line(executionOptions.args);
    nugetTool.arg("-NonInteractive");

    const execResult = nugetTool.execSync();
    if (execResult.code !== 0) {
        telemetry.logResult("Packaging", "NuGetCommand", execResult.code);
        throw tl.loc("Error_NugetFailedWithCodeAndErr",
            execResult.code,
            execResult.stderr ? execResult.stderr.trim() : execResult.stderr);
    }
    return execResult;
}
