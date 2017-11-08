import * as url from "url";
import * as tl from "vsts-task-lib/task";
import {IExecOptions, IExecSyncResult, ToolRunner} from "vsts-task-lib/toolrunner";

import * as auth from "./Authentication";
import {NuGetQuirkName, NuGetQuirks, defaultQuirks} from "./NuGetQuirks";
import * as ngutil from "./Utility";
import * as peParser from "./pe-parser";
import * as commandHelper from "./CommandHelper";

// NuGetToolRunner2 can handle environment setup for new authentication scenarios where
// we are accessing internal or external package sources.
// It is used by the NuGetCommand >= v2.0.0 and DotNetCoreCLI >= v2.0.0

interface EnvironmentDictionary { [key: string]: string; }

export interface NuGetEnvironmentSettings {
    credProviderFolder: string;
    extensionsDisabled: boolean;
}

function prepareNuGetExeEnvironment(
    input: EnvironmentDictionary,
    settings: NuGetEnvironmentSettings,
    authInfo: auth.NuGetExtendedAuthInfo): EnvironmentDictionary {

    let env: EnvironmentDictionary = {};
    let originalCredProviderPath: string;
    for (let e in input) {
        if (!input.hasOwnProperty(e)) {
            continue;
        }
        // NuGet.exe extensions only work with a single specific version of nuget.exe. This causes problems
        // whenever we update nuget.exe on the agent.
        if (e.toUpperCase() === "NUGET_EXTENSIONS_PATH") {
            if (settings.extensionsDisabled) {
                tl.warning(tl.loc("NGCommon_IgnoringNuGetExtensionsPath"));
                continue;
            } else {
                console.log(tl.loc("NGCommon_DetectedNuGetExtensionsPath", input[e]));
            }
        }

        if (e.toUpperCase() === "NUGET_CREDENTIALPROVIDERS_PATH") {
            originalCredProviderPath = input[e];

            // will re-set this variable below
            continue;
        }

        env[e] = input[e];
    }

    let credProviderPath = settings.credProviderFolder || originalCredProviderPath;
    if (settings.credProviderFolder && originalCredProviderPath) {
        credProviderPath = settings.credProviderFolder + ";" + originalCredProviderPath;
    }

    if (authInfo && authInfo.internalAuthInfo){
        env["VSS_NUGET_ACCESSTOKEN"] = authInfo.internalAuthInfo.accessToken;
        env["VSS_NUGET_URI_PREFIXES"] = authInfo.internalAuthInfo.uriPrefixes.join(";");
    }

    env["NUGET_CREDENTIAL_PROVIDER_OVERRIDE_DEFAULT"] = "true";

    if (credProviderPath) {
        tl.debug(`credProviderPath = ${credProviderPath}`);
        env["NUGET_CREDENTIALPROVIDERS_PATH"] = credProviderPath;
    }

    let httpProxy = getNuGetProxyFromEnvironment();
    if (httpProxy) {
        tl.debug(`Adding environment variable for NuGet proxy: ${httpProxy}`);
        env["HTTP_PROXY"] = httpProxy;
    }

    return env;
}

export class NuGetToolRunner2 extends ToolRunner {
    private settings: NuGetEnvironmentSettings;
    private authInfo: auth.NuGetExtendedAuthInfo;

    constructor(nuGetExePath: string, settings: NuGetEnvironmentSettings, authInfo: auth.NuGetExtendedAuthInfo) {
        if (tl.osType() === 'Windows_NT' || !nuGetExePath.trim().toLowerCase().endsWith(".exe")) {
            super(nuGetExePath);
        }
        else {
            let monoPath = tl.which("mono", true);
            super(monoPath);
            this.arg(nuGetExePath);
        }

        this.settings = settings;
        this.authInfo = authInfo;
    }

    public execSync(options?: IExecOptions): IExecSyncResult {
        options = options || <IExecOptions>{};
        options.env = prepareNuGetExeEnvironment(options.env || process.env, this.settings, this.authInfo);
        let execResult = super.execSync(options);
        if (execResult.code !== 0) {
            this._logExecResults(execResult.code, execResult.stderr);
        }
        return execResult;
    }

    public exec(options?: IExecOptions): Q.Promise<number> {
        options = options || <IExecOptions>{};
        options.env = prepareNuGetExeEnvironment(options.env || process.env, this.settings, this.authInfo);
        return super.exec(options);
    }


    private _logExecResults(exitCode: number, stderr: string){
        try{
            console.log("##vso[telemetry.publish area=Packaging;feature=NuGetCommand]%s",
            JSON.stringify({
                'SYSTEM_JOBID': tl.getVariable('SYSTEM_JOBID'),
                'SYSTEM_PLANID': tl.getVariable('SYSTEM_PLANID'),
                'SYSTEM_COLLECTIONID': tl.getVariable('SYSTEM_COLLECTIONID'),
                'command': tl.getInput("command"),
                'arguments': tl.getInput("arguments"),
                'exitCode': exitCode,
                'stderr': (stderr) ? stderr.substr(0, 1024) : null
            }));
        }catch(err) {
            tl.debug(`Unable to log telemetry. Err:( ${err} )`);
        }
    }
}

export function createNuGetToolRunner(nuGetExePath: string, settings: NuGetEnvironmentSettings, authInfo: auth.NuGetExtendedAuthInfo): NuGetToolRunner2 {
    let runner = new NuGetToolRunner2(nuGetExePath, settings, authInfo);
    runner.on("debug", message => tl.debug(message));
    return runner;
}

export async function getNuGetQuirksAsync(nuGetExePath: string): Promise<NuGetQuirks> {
    try {
        const version = await peParser.getFileVersionInfoAsync(nuGetExePath);
        const quirks = NuGetQuirks.fromVersion(version.fileVersion);

        console.log(tl.loc("NGCommon_DetectedNuGetVersion", version.fileVersion, version.strings.ProductVersion));
        tl.debug(`Quirks for ${version.fileVersion}:`);
        quirks.getQuirkNames().forEach(quirk => {
            tl.debug(`    ${quirk}`);
        });

        return quirks;
    } catch (err) {
        if (err.code && (
            err.code === "invalidSignature"
            || err.code === "noResourceSection"
            || err.code === "noVersionResource")) {

            tl.debug("Cannot read version from NuGet. Using default quirks:");
            defaultQuirks.forEach(quirk => {
                tl.debug(`    ${NuGetQuirkName[quirk]}`);
            });
            return new NuGetQuirks(null, defaultQuirks);
        }

        throw err;
    }
}

// Currently, there is a race condition of some sort that causes nuget to not send credentials sometimes
// when using the credential provider.
// Unfortunately, on on-premises TFS, we must use credential provider to override NTLM auth with the build
// identity's token.
// Therefore, we are enabling credential provider on on-premises and disabling it on hosted (only when the version of NuGet does not support it). We allow for test
// instances by an override variable.

export function isCredentialProviderEnabled(quirks: NuGetQuirks): boolean {
    // set NuGet.ForceEnableCredentialProvider to "true" to force allowing the credential provider flow, "false"
    // to force *not* allowing the credential provider flow, or unset/anything else to fall through to the
    // hosted environment detection logic
    const credentialProviderOverrideFlag = tl.getVariable("NuGet.ForceEnableCredentialProvider");
    if (credentialProviderOverrideFlag === "true") {
        tl.debug("Credential provider is force-enabled for testing purposes.");
        return true;
    }

    if (credentialProviderOverrideFlag === "false") {
        tl.debug("Credential provider is force-disabled for testing purposes.");
        return false;
    }

    if (quirks.hasQuirk(NuGetQuirkName.NoCredentialProvider)
        || quirks.hasQuirk(NuGetQuirkName.CredentialProviderRace)) {
        tl.debug("Credential provider is disabled due to quirks.");
        return false;
    }

    if (commandHelper.isOnPremisesTfs() && (
        quirks.hasQuirk(NuGetQuirkName.NoTfsOnPremAuthCredentialProvider))) {
        tl.debug("Credential provider is disabled due to on-prem quirks.");
        return false;
    }

    tl.debug("Credential provider is enabled.");
    return true;
}

export function isCredentialConfigEnabled(quirks: NuGetQuirks): boolean {
    // set NuGet.ForceEnableCredentialConfig to "true" to force allowing config-based credential flow, "false"
    // to force *not* allowing config-based credential flow, or unset/anything else to fall through to the
    // hosted environment detection logic
    const credentialConfigOverrideFlag = tl.getVariable("NuGet.ForceEnableCredentialConfig");
    if (credentialConfigOverrideFlag === "true") {
        tl.debug("Credential config is force-enabled for testing purposes.");
        return true;
    }

    if (credentialConfigOverrideFlag === "false") {
        tl.debug("Credential config is force-disabled for testing purposes.");
        return false;
    }

    if (commandHelper.isOnPremisesTfs() && (
        quirks.hasQuirk(NuGetQuirkName.NoTfsOnPremAuthConfig))) {
        tl.debug("Credential config is disabled due to on-prem quirks.");
        return false;
    }

    tl.debug("Credential config is enabled.");
    return true;
}

export function getNuGetProxyFromEnvironment(): string {
    let proxyUrl: string = tl.getVariable("agent.proxyurl");
    let proxyUsername: string = tl.getVariable("agent.proxyusername");
    let proxyPassword: string = tl.getVariable("agent.proxypassword");

    if (proxyUrl !== undefined) {
        let proxy: url.Url = url.parse(proxyUrl);

        if (proxyUsername !== undefined) {
            proxy.auth = proxyUsername;

            if (proxyPassword !== undefined) {
                proxy.auth += `:${proxyPassword}`;
            }
        }

        return url.format(proxy);
    }

    return undefined;
}
