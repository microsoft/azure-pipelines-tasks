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
interface EndpointCredentials {
    endpoint: string;
    username?: string;
    password: string;
}
interface EnpointCredentialsContainer {
    endpointCredentials: EndpointCredentials[];
}
export interface NuGetEnvironmentSettings {
    /* V1 credential provider folder path. Only populated if V1 should be used. */
    credProviderFolder?: string;
    /* V2 credential provider path. Only populated if V2 should be used. */
    V2CredProviderPath?: string
    extensionsDisabled: boolean;
}

function prepareNuGetExeEnvironment(
    input: EnvironmentDictionary,
    settings: NuGetEnvironmentSettings,
    authInfo: auth.NuGetExtendedAuthInfo): EnvironmentDictionary {

    let env: EnvironmentDictionary = {};
    let originalCredProviderPath: string = null;
    let envVarCredProviderPathV2: string = null;

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

        // New credential provider
        if (e.toUpperCase() === "NUGET_PLUGIN_PATHS") {
            envVarCredProviderPathV2 = input[e];
            continue;
        }

        // Old credential provider
        if (e.toUpperCase() === "NUGET_CREDENTIALPROVIDERS_PATH") {
            originalCredProviderPath = input[e];
            continue;
        }

        env[e] = input[e];
    }

    if (authInfo && authInfo.internalAuthInfo) {
        env["VSS_NUGET_ACCESSTOKEN"] = authInfo.internalAuthInfo.accessToken;
        env["VSS_NUGET_URI_PREFIXES"] = authInfo.internalAuthInfo.uriPrefixes.join(";");
    }

    env["NUGET_CREDENTIAL_PROVIDER_OVERRIDE_DEFAULT"] = "true";

    // Old credential provider
    if (settings.credProviderFolder != null || originalCredProviderPath != null) {
        let credProviderPath = buildCredProviderPath(originalCredProviderPath, settings.credProviderFolder);

        if (credProviderPath) {
            env["NUGET_CREDENTIALPROVIDERS_PATH"] = credProviderPath;
            tl.debug(`V1 credential provider set`);
            tl.debug(`credProviderPath = ${credProviderPath}`);
        }
    }
    
    // New credential provider
    if (settings.V2CredProviderPath != null || envVarCredProviderPathV2 != null) {
        let credProviderPath = buildCredProviderPath(envVarCredProviderPathV2, settings.V2CredProviderPath);

        if (credProviderPath) {
            env["NUGET_PLUGIN_PATHS"] = credProviderPath;
            tl.debug(`V2 credential provider set`);
            tl.debug(`credProviderPath = ${credProviderPath}`);
        }

        // NuGet restore task will pass external credentials to V2 credential provider
        let externalCredentials = buildCredentialJson(authInfo);
        if (externalCredentials) {
            env["VSS_NUGET_EXTERNAL_FEED_ENDPOINTS"] = externalCredentials;
        }
    }

    let httpProxy = getNuGetProxyFromEnvironment();
    if (httpProxy) {
        tl.debug(`Adding environment variable for NuGet proxy: ${httpProxy}`);
        env["HTTP_PROXY"] = httpProxy;
    }

    return env;
}

function buildCredProviderPath(credProviderPath1: string, credProviderPath2: string): string {
    if (credProviderPath1 && credProviderPath2) {
        return credProviderPath1 + ";" + credProviderPath2;
    }
    return credProviderPath1 || credProviderPath2;
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
        return super.execSync(options);
    }

    public exec(options?: IExecOptions): Q.Promise<number> {
        options = options || <IExecOptions>{};
        options.env = prepareNuGetExeEnvironment(options.env || process.env, this.settings, this.authInfo);
        return super.exec(options);
    }
}

export function createNuGetToolRunner(nuGetExePath: string, settings: NuGetEnvironmentSettings, authInfo: auth.NuGetExtendedAuthInfo): NuGetToolRunner2 {
    nuGetExePath = ngutil.resolveToolPath(nuGetExePath);
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
// This checks if V1 credential provider is enabled
export function isCredentialProviderEnabled(quirks: NuGetQuirks): boolean {
    // set NuGet.ForceEnableCredentialProvider to "true" to force allowing the credential provider flow, "false"
    // to force *not* allowing the credential provider flow, or unset/anything else to fall through to the 
    // hosted environment detection logic
    const credentialProviderOverrideFlag = tl.getVariable("NuGet.ForceEnableCredentialProvider"); // forces V1 credential provider
    if (credentialProviderOverrideFlag === "true") {
        tl.debug("V1 credential provider is force-enabled for testing purposes.");
        return true;
    }

    if (credentialProviderOverrideFlag === "false") {
        tl.debug("V1 credential provider is force-disabled for testing purposes.");
        return false;
    }

    // Disabling quirk check during investigation
    /*if (quirks.hasQuirk(NuGetQuirkName.V2CredentialProvider) === true) {
        tl.debug("Credential provider V1 is disabled in favor of V2 plugin.");
        return false;
    }*/
    
    if (isAnyCredentialProviderEnabled(quirks)) {
        tl.debug("V1 credential provider is enabled");
        return true;
    }

    return false;
}

// This checks if V2 credential provider is enabled
export function isCredentialProviderV2Enabled(quirks: NuGetQuirks): boolean {
    const credentialProviderOverrideFlagV2 = tl.getVariable("NuGet_ForceEnableCredentialProviderV2");
    if (credentialProviderOverrideFlagV2 === "true") {
        tl.debug("V2 Credential provider is force-enabled.");
        return true;
    }

    if (credentialProviderOverrideFlagV2 === "false") {
        tl.debug("V2 Credential provider is force-disabled.");
        return false;
    }

    if (isAnyCredentialProviderEnabled(quirks) === false) {
        return false;
    }

    // Disabling quirk check during investigation
    /*if (quirks.hasQuirk(NuGetQuirkName.V2CredentialProvider) === true) {
        tl.debug("V2 credential provider is enabled.");
        return true;
    }*/

    tl.debug("V2 credential provider is disabled due to quirks. To use V2 credential provider use NuGet version 4.8 or higher.");
    return false;
}

function isAnyCredentialProviderEnabled(quirks: NuGetQuirks): boolean {
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

function buildCredentialJson(authInfo: auth.NuGetExtendedAuthInfo): string {
    if (authInfo && authInfo.externalAuthInfo) {
        let enpointCredentialsJson: EnpointCredentialsContainer = {
            endpointCredentials: [] as EndpointCredentials[]
        };

        tl.debug(`Detected external credentials for:`);
        authInfo.externalAuthInfo.forEach((authInfo) => {
            switch(authInfo.authType) {
                case (auth.ExternalAuthType.UsernamePassword):
                    let usernamePasswordAuthInfo =  authInfo as auth.UsernamePasswordExternalAuthInfo;
                    enpointCredentialsJson.endpointCredentials.push({
                        endpoint: authInfo.packageSource.feedUri,
                        username: usernamePasswordAuthInfo.username,
                        password: usernamePasswordAuthInfo.password
                        
                    } as EndpointCredentials);
                    tl.debug(authInfo.packageSource.feedUri);
                    break;
                case (auth.ExternalAuthType.Token):
                    let tokenAuthInfo =  authInfo as auth.TokenExternalAuthInfo;
                    enpointCredentialsJson.endpointCredentials.push({
                        endpoint: authInfo.packageSource.feedUri,
                        /* No username provided */
                        password: tokenAuthInfo.token
                    } as EndpointCredentials);
                    tl.debug(authInfo.packageSource.feedUri);
                    break;
                case (auth.ExternalAuthType.ApiKey):
                    /* ApiKey is only valid form of credentials for the push command.
                    Only the NuGet Restore task will use the V2 credential provider for handling external credentials.*/
                    tl.debug(authInfo.packageSource.feedUri);
                    tl.debug(`ApiKey is not supported`);
                    break;
                default:
                    break;
            }
        });

        const externalCredentials: string = JSON.stringify(enpointCredentialsJson);
        return externalCredentials;
    }

    return null;
}