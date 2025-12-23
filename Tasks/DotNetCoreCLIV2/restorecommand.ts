import * as tl from 'azure-pipelines-task-lib/task';
import * as Q from 'q';
import * as utility from './Common/utility';
import * as auth from 'azure-pipelines-tasks-packaging-common/nuget/Authentication';
import { NuGetConfigHelper2 } from 'azure-pipelines-tasks-packaging-common/nuget/NuGetConfigHelper2';
import * as ngRunner from 'azure-pipelines-tasks-packaging-common/nuget/NuGetToolRunner2';
import * as path from 'path';
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';
import * as nutil from 'azure-pipelines-tasks-packaging-common/nuget/Utility';
import * as commandHelper from 'azure-pipelines-tasks-packaging-common/nuget/CommandHelper';
import * as pkgLocationUtils from 'azure-pipelines-tasks-packaging-common/locationUtilities';
import { getProjectAndFeedIdFromInputParam, logError } from 'azure-pipelines-tasks-packaging-common/util';
import { RequestOptions } from 'azure-pipelines-tasks-packaging-common/universal/RequestUtilities';
import * as fs from 'fs';
import * as xml2js from 'xml2js';


export async function run(): Promise<void> {
    console.log(tl.loc('DeprecatedDotnet2_2_And_3_0'));
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        const timeout: number = utility.getRequestTimeout();
        const webApiOptions: RequestOptions = { 
            socketTimeout: timeout,
            globalAgentOptions: {
                timeout: timeout,
            } 
        };
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.NuGet, webApiOptions);
    } catch (error) {
        tl.debug('Unable to get packaging URIs');
        logError(error);
        throw error;
    }
    const buildIdentityDisplayName: string = null;
    const buildIdentityAccount: string = null;

    try {
        const projectSearch = tl.getDelimitedInput('projects', '\n', false);

        // if no projectSearch strings are given, use "" to operate on the current directory
        const projectFiles = utility.getProjectFiles(projectSearch);

        if (projectFiles.length === 0) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('Info_NoFilesMatchedTheSearchPattern'));
            return;
        }
        const noCache = tl.getBoolInput('noCache');
        const verbosity = tl.getInput('verbosityRestore');
        let packagesDirectory = tl.getPathInput('packagesDirectory');
        if (!tl.filePathSupplied('packagesDirectory')) {
            packagesDirectory = null;
        }

        // Setting up auth-related variables
        tl.debug('Setting up auth');
        const serviceUri = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
        let urlPrefixes = packagingLocation.PackagingUris;
        tl.debug(`Discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        const testPrefixes = tl.getVariable('DotNetCoreCLITask.ExtraUrlPrefixesForTesting');
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(';'));
            tl.debug(`All URL prefixes: ${urlPrefixes}`);
        }

        const accessToken = pkgLocationUtils.getSystemAccessToken();

        const externalAuthArr: auth.ExternalAuthInfo[] = commandHelper.GetExternalAuthInfoArray('externalEndpoints');
        const authInfo = new auth.NuGetExtendedAuthInfo(new auth.InternalAuthInfo(urlPrefixes, accessToken, /*useCredProvider*/ null, /*useCredConfig*/ true), externalAuthArr);
        // Setting up sources, either from provided config file or from feed selection
        tl.debug('Setting up sources');
        let nuGetConfigPath: string = undefined;
        const selectOrConfig = tl.getInput('selectOrConfig');

        // This IF is here in order to provide a value to nuGetConfigPath (if option selected, if user provided it)
        // and then pass it into the config helper
        if (selectOrConfig === 'config') {
            nuGetConfigPath = tl.getPathInput('nugetConfigPath', false, true);
            if (!tl.filePathSupplied('nugetConfigPath')) {
                nuGetConfigPath = undefined;
            }
        }

        // If there was no nuGetConfigPath, NuGetConfigHelper will create one
        const nuGetConfigHelper = new NuGetConfigHelper2(
            null,
            nuGetConfigPath,
            authInfo,
            { credProviderFolder: null, extensionsDisabled: true },
            null /* tempConfigPath */,
            false /* useNugetToModifyConfigFile */);

        let credCleanup = () => {
            if (tl.exist(nuGetConfigHelper.tempNugetConfigPath)) {
                tl.rmRF(nuGetConfigHelper.tempNugetConfigPath)
            }
        };

        let isNugetOrgBehaviorWarn = false;

        // Now that the NuGetConfigHelper was initialized with all the known information we can proceed
        // and check if the user picked the 'select' option to fill out the config file if needed
        if (selectOrConfig === 'select') {
            const sources: Array<auth.IPackageSource> = new Array<auth.IPackageSource>();
            const feed = getProjectAndFeedIdFromInputParam('feedRestore');

            if (feed.feedId) {
                const feedUrl: string = await nutil.getNuGetFeedRegistryUrl(packagingLocation.DefaultPackagingUri, feed.feedId, feed.projectId, null, accessToken);
                sources.push(<auth.IPackageSource>
                    {
                        feedName: feed.feedId,
                        feedUri: feedUrl,
                        isInternal: true
                    });
            }

            const includeNuGetOrg = tl.getBoolInput('includeNuGetOrg', false);
            if (includeNuGetOrg) {
                // If includeNuGetOrg is true, check the INCLUDE_NUGETORG_BEHAVIOR env variable to determine task result 
                // this allows compliance checks to warn or break the task if consuming from nuget.org directly 
                const nugetOrgBehavior = includeNuGetOrg ? tl.getVariable("INCLUDE_NUGETORG_BEHAVIOR") : undefined;
                tl.debug(`NugetOrgBehavior: ${nugetOrgBehavior}`);

                if(nugetOrgBehavior?.toLowerCase() == "fail"){
                    throw new Error(tl.loc("Error_IncludeNuGetOrgEnabled"));
                } else if (nugetOrgBehavior?.toLowerCase() == "warn"){
                    isNugetOrgBehaviorWarn = true;
                }

                sources.push(auth.NuGetOrgV3PackageSource);
            }

            // Creating NuGet.config for the user
            if (sources.length > 0) {
                tl.debug(`Adding the following sources to the config file: ${sources.map(x => x.feedName).join(';')}`);
                nuGetConfigHelper.addSourcesToTempNuGetConfig(sources);
                nuGetConfigPath = nuGetConfigHelper.tempNugetConfigPath;
            } else {
                tl.debug('No sources were added to the temp NuGet.config file');
            }
        }

        // Setting creds in the temp NuGet.config if needed
        nuGetConfigHelper.setAuthForSourcesInTempNuGetConfig();

        await syncPackageSourceMappingKeysXml2js(nuGetConfigPath, nuGetConfigHelper.tempNugetConfigPath);

        const configFile = nuGetConfigHelper.tempNugetConfigPath;

        nuGetConfigHelper.backupExistingRootNuGetFiles();

        const dotnetPath = tl.which('dotnet', true);

        try {
            const additionalRestoreArguments = tl.getInput('restoreArguments', false);
            for (const projectFile of projectFiles) {
                await dotNetRestoreAsync(dotnetPath, projectFile, packagesDirectory, configFile, noCache, verbosity, additionalRestoreArguments);
            }
        } finally {
            credCleanup();
            nuGetConfigHelper.restoreBackupRootNuGetFiles();
        }

        isNugetOrgBehaviorWarn 
        ? tl.setResult(tl.TaskResult.SucceededWithIssues, tl.loc("Warning_IncludeNuGetOrgEnabled"))
        : tl.setResult(tl.TaskResult.Succeeded, tl.loc("PackagesInstalledSuccessfully"));
    } catch (err) {

        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc('BuildIdentityPermissionsHint', buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc('PackagesFailedToInstall'));
    }
}

function dotNetRestoreAsync(dotnetPath: string, projectFile: string, packagesDirectory: string, configFile: string, noCache: boolean, verbosity: string, additionalRestoreArguments?: string): Q.Promise<number> {
    const dotnet = tl.tool(dotnetPath);
    dotnet.arg('restore');

    if (projectFile) {
        dotnet.arg(projectFile);
    }

    if (packagesDirectory) {
        dotnet.arg('--packages');
        dotnet.arg(packagesDirectory);
    }

    dotnet.arg('--configfile');
    dotnet.arg(configFile);

    if (noCache) {
        dotnet.arg('--no-cache');
    }

    if (verbosity && verbosity !== '-') {
        dotnet.arg('--verbosity');
        dotnet.arg(verbosity);
    }

    if (additionalRestoreArguments) {
        dotnet.line(additionalRestoreArguments);
    }

    const envWithProxy = ngRunner.setNuGetProxyEnvironment(process.env, configFile, null);
    return dotnet.exec({ cwd: path.dirname(projectFile), env: envWithProxy } as IExecOptions);
}

async function syncPackageSourceMappingKeysXml2js(
  originalConfigPath: string | undefined,
  tempConfigPath: string
): Promise<void> {
  try {
    if (!tempConfigPath || !fs.existsSync(tempConfigPath)) {
      tl.debug(`[PSM-Sync] Temp config not found: ${tempConfigPath}; skipping.`);
      return;
    }

    // Parse TEMP (post-prefix) config
    const tempXmlText = fs.readFileSync(tempConfigPath, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: true, preserveChildrenOrder: true });
    const tempDoc: any = await parser.parseStringPromise(tempXmlText);

    // Build URL→Key maps for TEMP and ORIGINAL (if provided)
    const tempUrlToKey = extractUrlToKeyMap(tempDoc);
    if (!originalConfigPath || !fs.existsSync(originalConfigPath)) {
      tl.debug('[PSM-Sync] Original config not provided/found; skipping.');
      return;
    }
    const origXmlText = fs.readFileSync(originalConfigPath, 'utf8');
    const origDoc: any = await parser.parseStringPromise(origXmlText);
    const origUrlToKey = extractUrlToKeyMap(origDoc);

    // Compute origKey → tempKey mapping via exact URL match
    const origKeyToTempKey = new Map<string, string>();
    for (const [url, origKey] of origUrlToKey.entries()) {
      const tempKey = tempUrlToKey.get(url);
      if (tempKey && tempKey !== origKey) {
        origKeyToTempKey.set(origKey, tempKey); // e.g., canarytest → feed-canarytest
      }
    }
    if (origKeyToTempKey.size === 0) {
      tl.debug('[PSM-Sync] No orig→temp key differences computed; skipping rewrite.');
      return;
    }

    // Rewrite keys under <packageSourceMapping> in TEMP doc
    const cfg = tempDoc?.configuration;
    const psmArr = cfg?.packageSourceMapping;
    if (!Array.isArray(psmArr) || psmArr.length === 0) {
      tl.debug('[PSM-Sync] No <packageSourceMapping> section; skipping.');
      return;
    }
    const psmNode = psmArr[0];
    const psmSources = psmNode?.packageSource;
    if (!Array.isArray(psmSources) || psmSources.length === 0) {
      tl.debug('[PSM-Sync] No <packageSource> children under mapping; skipping.');
      return;
    }

    let changed = false;
    for (const src of psmSources) {
      const attrs = src?.$;
      const originalKey = attrs?.key?.trim();
      if (!originalKey) continue;

      const newKey = origKeyToTempKey.get(originalKey);
      if (newKey) {
        tl.debug(`[PSM-Sync] Rewriting mapping key '${originalKey}' → '${newKey}'`);
        attrs.key = newKey;
        changed = true;
      }
    }

    if (changed) {
      const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'utf-8' } });
      const outXml = builder.buildObject(tempDoc);
      fs.writeFileSync(tempConfigPath, outXml, 'utf8');
      tl.debug('[PSM-Sync] Synchronized <packageSourceMapping> keys in temp NuGet.config.');
    } else {
      tl.debug('[PSM-Sync] Mapping keys already consistent; no changes written.');
    }
  } catch (e: any) {
    tl.warning(`[PSM-Sync] Synchronization skipped due to error: ${e?.message ?? String(e)}`);
  }
}

function extractUrlToKeyMap(doc: any): Map<string, string> {
  const result = new Map<string, string>();
  const cfg = doc?.configuration;
  const psArr = cfg?.packageSources;
  if (!Array.isArray(psArr) || psArr.length === 0) return result;

  const psNode = psArr[0];
  const adds = psNode?.add;
  if (!Array.isArray(adds)) return result;

  for (const add of adds) {
    const a = add?.$;
    const key = a?.key;
    const value = a?.value;
    if (typeof key === 'string' && typeof value === 'string') {
      result.set(normalizeUrl(value), key.trim());
    }
  }
  return result;
}

function normalizeUrl(u: string): string {
  return (u ?? '')
    .trim()
    .replace(/\s+/g, '')         // collapse/strip spaces
    .replace(/\/+$/g, '')        // strip trailing slashes
    .toLowerCase();
}

