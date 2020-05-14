import * as url from "url";
import * as tl from "azure-pipelines-task-lib/task";
import {IExecOptions, IExecSyncResult, ToolRunner} from "azure-pipelines-task-lib/toolrunner";

import * as auth from "./Authentication";
import {NuGetQuirkName, NuGetQuirks, defaultQuirks} from "./NuGetQuirks";
import * as ngutil from "./Utility";
import * as peParser from "../pe-parser";
import * as commandHelper from "./CommandHelper";
import * as path from "path";

// NuGetToolRunner2 can handle environment setup for new authentication scenarios where
// we are accessing internal or external package sources.
// It is used by the NuGetCommand >= v2.0.0 and DotNetCoreCLI >= v2.0.0

export interface EnvironmentDictionary { [key: string]: string; }
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

    /* NO_PROXY support
    / Agent.ProxyBypassList supplies a list of regexes, nuget is expecting a list of comma seperated domains.
    / so we need to determine if the uris match any of the regexes. */
    // provide to read the uris from a config file (install)
    configFile?: string;
    // provide to just match against a single uri (publish)
    registryUri?: string;
}

function prepareNuGetExeEnvironment(
    input: EnvironmentDictionary,
    settings: NuGetEnvironmentSettings,
    authInfo: auth.NuGetExtendedAuthInfo): EnvironmentDictionary {

    let env: EnvironmentDictionary = {};
    let originalCredProviderPath: string = null;
    let envVarCredProviderPathV2: string = null;
    let nugetCacheDir: string = null;
    let disableNuGetPluginCacheWorkaround: boolean = false;

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

        if (e.toUpperCase() === "DISABLE_NUGET_PLUGINS_CACHE_WORKAROUND") {
            // Specifically disable NUGET_PLUGINS_CACHE_PATH workaround
            disableNuGetPluginCacheWorkaround = true;
            continue;
        }

        // NuGet plugins cache
        if (e.toUpperCase() === "NUGET_PLUGINS_CACHE_PATH") {
            nugetCacheDir = input[e];
            continue;
        }

        env[e] = input[e];
    }

    // If DISABLE_NUGET_PLUGINS_CACHE_WORKAROUND variable is not set 
    // and nugetCacheDir is not populated by NUGET_PLUGINS_CACHE_PATH,
    // set NUGET_PLUGINS_CACHE_PATH to the temp directory
    // to work aroud the NuGet issue with long paths: https://github.com/NuGet/Home/issues/7770
    if (nugetCacheDir == null && disableNuGetPluginCacheWorkaround === false) {
        const tempDir = tl.getVariable('Agent.TempDirectory');
        nugetCacheDir = path.join(tempDir, "NuGetPluginsCache");
    }
    if (nugetCacheDir != null) {
        env["NUGET_PLUGINS_CACHE_PATH"] = nugetCacheDir;
        tl.debug(`NUGET_PLUGINS_CACHE_PATH set to ${nugetCacheDir}`);
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

    env = setNuGetProxyEnvironment(env, settings.configFile, settings.registryUri);
    return env;
}

// Adds the HTTP_PROXY and NO_PROXY values (if applicable) to the input dictionary
export function setNuGetProxyEnvironment(input: EnvironmentDictionary,
    configFile?: string,
    registryUri?: string): EnvironmentDictionary {
    let httpProxy = getNuGetProxyFromEnvironment();
    if (httpProxy) {
        tl.debug(`Adding environment variable for NuGet proxy: HTTP_PROXY`);
        input["HTTP_PROXY"] = httpProxy;

        let proxybypass: string;
        if (configFile != null) {
            proxybypass = getProxyBypassForConfig(configFile);

        } else if (registryUri != null) {
            proxybypass = getProxyBypassForUri(registryUri);
        }

        if (proxybypass) {
            tl.debug(`Adding environment variable for NuGet proxy bypass: NO_PROXY`);

            // check if there are any existing NO_PROXY values
            let existingNoProxy = process.env["NO_PROXY"];
            if (existingNoProxy) {
                existingNoProxy = existingNoProxy.trimRight();
                // trim trailing comma
                existingNoProxy = existingNoProxy.endsWith(',') ? existingNoProxy.slice(0,-1) : existingNoProxy;
                // append our bypass list
                proxybypass = existingNoProxy + ',' + proxybypass;
            }

            input["NO_PROXY"] = proxybypass;
        }
    }

    return input;
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

    const isWindows = tl.osType() === "Windows_NT";
    if (quirks.hasQuirk(NuGetQuirkName.V2CredentialProvider) === true && isWindows) {
        tl.debug("Credential provider V1 is disabled in favor of V2 plugin.");
        return false;
    }
    
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

    const isWindows = tl.osType() === "Windows_NT";
    if (quirks.hasQuirk(NuGetQuirkName.V2CredentialProvider) === true && isWindows) {
        tl.debug("V2 credential provider is enabled.");
        return true;
    }

    tl.debug("V2 credential provider is disabled.");
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

export function getProxyBypassForUri(registryUri: string): string {
    // check if there are any proxy bypass hosts
    const proxyBypassHosts: string[] = JSON.parse(tl.getVariable('Agent.ProxyBypassList') || '[]'); 
    if (proxyBypassHosts == null || proxyBypassHosts.length == 0) {
        return undefined;
    }

    const uri = url.parse(registryUri);
    if (uri.hostname != null) {
        const bypass = proxyBypassHosts.some(bypassHost => {
            return (new RegExp(bypassHost, 'i').test(uri.href));
        });
        if (bypass) {
            return uri.hostname;
        }
    }
    return undefined;
}

export function getProxyBypassForConfig(configFile: string): string {
    // check if there are any proxy bypass hosts
    const proxyBypassHosts: string[] = JSON.parse(tl.getVariable('Agent.ProxyBypassList') || '[]'); 
    if (proxyBypassHosts == null || proxyBypassHosts.length == 0) {
        return undefined;
    }

    // get the potential package sources
    let sources = ngutil.getSourcesFromNuGetConfig(configFile);

    // convert to urls
    let sourceUris = sources.reduce(function(result: url.Url[], current: auth.IPackageSourceBase): url.Url[] {
        try {
            const uri = url.parse(current.feedUri);
            if (uri.hostname != null) {
                result.push(uri);
            }
        }
        finally {
            return result;
        }
    }, []);

    const bypassDomainSet = new Set<string>(); 
    proxyBypassHosts.forEach((bypassHost => {
        // if there are no more sources, stop processing regexes
        if (sourceUris == null || sourceUris.length == 0) {
            return;
        }

        let regex = new RegExp(bypassHost, 'i');
        
        // filter out the sources that match the current regex
        sourceUris = sourceUris.filter(sourceUri => {
            if (regex.test(sourceUri.href)) {
                bypassDomainSet.add(sourceUri.hostname);
                return false;
            }
            return true;
        });
    }));

    // return a comma separated list of the bypass domains
    if (bypassDomainSet.size > 0) {
        const bypassDomainArray = Array.from(bypassDomainSet);
        return bypassDomainArray.join(',');
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

        if (enpointCredentialsJson.endpointCredentials.length < 1) {
            tl.debug(`None detected.`);
            return null;
        }

        const externalCredentials: string = JSON.stringify(enpointCredentialsJson);
        return externalCredentials;
    }

    return null;
}