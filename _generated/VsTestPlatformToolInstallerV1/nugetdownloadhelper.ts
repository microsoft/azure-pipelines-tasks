import * as tl from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as path from 'path';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';
import * as helpers from './helpers';

let startTime: number;

export class NugetDownloadHelper {
    // Attemps to download the package and on failure looks for the latest stable version already present in the cache
    public async attemptPackageDownload(packageSource: string, testPlatformVersion: string, nugetConfigFilePath: string) : Promise<string> {
        let vstestPlatformInstalledLocation;
        try {
            tl.debug(`Could not find ${constants.packageId}.${testPlatformVersion} in the tools cache. Fetching it from nuget.`);

            // Download the required version and cache it
            vstestPlatformInstalledLocation = await this.acquireAndCacheVsTestPlatformNuget(packageSource,
                testPlatformVersion, nugetConfigFilePath);

        } catch (error) {
            tl.error(tl.loc('TestPlatformDownloadFailed', testPlatformVersion, error));

            if ((tl.getInput(constants.packageFeedSelector) === constants.nugetOrg || tl.getInput(constants.packageFeedSelector) === constants.customFeed)
                && tl.getInput(constants.versionSelector) === constants.specificVersion) {
                return null;
            }

            console.log(tl.loc('LatestStableCached'));
            testPlatformVersion = 'x';

            ci.addToConsolidatedCi('downloadSucceeded', 'false');
            ci.publishEvent('DownloadFailed', { action: 'getLatestAvailableInCache', error: error } );
            startTime = perf();

            // Download failed, look for the latest version available in the cache
            vstestPlatformInstalledLocation = toolLib.findLocalTool(constants.toolFolderName, testPlatformVersion);

            ci.addToConsolidatedCi('secondCacheLookupTime', perf() - startTime);

            // No version found in cache, fail the task
            if (!vstestPlatformInstalledLocation || vstestPlatformInstalledLocation === 'undefined') {
                ci.addToConsolidatedCi('secondCacheLookupSucceeded', 'false');
                ci.addToConsolidatedCi('failureReason', constants.downloadFailed);
                tl.error(tl.loc('NoPackageFoundInCache'));
                throw new Error(tl.loc('FailedToAcquireTestPlatform'));
            }

            ci.addToConsolidatedCi('secondCacheLookupSucceeded', 'true');
        }

        return vstestPlatformInstalledLocation;
    }

    // Downloads and caches the test platform package
    private async acquireAndCacheVsTestPlatformNuget(packageSource: string, testPlatformVersion: string, nugetConfigFilePath: string): Promise<string> {
        testPlatformVersion = toolLib.cleanVersion(testPlatformVersion);
        const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));
        let downloadPath = helpers.getTempFolder();

        // Ensure Agent.TempDirectory is set
        if (!downloadPath) {
            throw new Error(tl.loc('ExpectedTempToBeSet'));
        }

        // Call out a warning if the agent work folder path is longer than 50 characters as anything longer may cause the download to fail
        // Note: This upper limit was calculated for a particular test platform package version and is subject to change
        if (tl.getVariable(constants.agentWorkFolder) && tl.getVariable(constants.agentWorkFolder).length > 50) {
            ci.addToConsolidatedCi('agentWorkDirectoryPathTooLong', 'true');
            tl.warning(tl.loc('AgentWorkDirectoryPathTooLong'));
        }

        // Use as short a path as possible due to nested folders in the package that may potentially exceed the 255 char windows path limit
        downloadPath = path.join(downloadPath, constants.toolFolderName);
        nugetTool.arg(constants.install).arg(constants.packageId).arg(constants.version).arg(testPlatformVersion).arg(constants.source)
            .arg(packageSource).arg(constants.outputDirectory).arg(downloadPath).arg(constants.noCache).arg(constants.directDownload)
            .argIf(nugetConfigFilePath, constants.configFile).argIf(nugetConfigFilePath, nugetConfigFilePath).arg(constants.noninteractive);

        tl.debug(`Downloading Test Platform version ${testPlatformVersion} from ${packageSource} to ${downloadPath}.`);
        startTime = perf();
        const resultCode = await nugetTool.exec();
        ci.addToConsolidatedCi('downloadTime', perf() - startTime);

        tl.debug(`Nuget.exe returned with result code ${resultCode}`);

        if (resultCode !== 0) {
            tl.error(tl.loc('NugetErrorCode', resultCode));
            throw new Error(tl.loc('DownloadFailed', resultCode));
        }

        // Install into the local tool cache
        const toolRoot = path.join(downloadPath, constants.packageId + '.' + testPlatformVersion);

        tl.debug(`Caching the downloaded folder ${toolRoot}.`);
        startTime = perf();
        const vstestPlatformInstalledLocation = await toolLib.cacheDir(toolRoot, constants.toolFolderName, testPlatformVersion);
        ci.addToConsolidatedCi('cacheTime', perf() - startTime);

        return vstestPlatformInstalledLocation;
    }
}