import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as path from 'path';
import { exec } from 'child_process';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';
import * as helpers from './helpers';
import { async } from 'q';

export class NugetDownloadHelper {
    public consolidatedCiData: { [key: string]: string; } = <{ [key: string]: string; }>{};

    public constructor(consolidatedCiData: { [key: string]: string; }) {
        this.consolidatedCiData = consolidatedCiData;
    }

    // Attemps to download the package and on failure looks for the latest stable version already present in the cache
    public async attemptPackageDownload(packageSource: string, testPlatformVersion: string) : Promise<string> {
        let vstestPlatformInstalledLocation;
        try {
            tl.debug(`Could not find ${constants.packageId}.${testPlatformVersion} in the tools cache. Fetching it from nuget.`);

            // Download the required version and cache it
            vstestPlatformInstalledLocation = await this.acquireAndCacheVsTestPlatformNuget(packageSource, testPlatformVersion, null);

        } catch (error) {
            tl.error(tl.loc('TestPlatformDownloadFailed', testPlatformVersion, error));

            testPlatformVersion = 'x';

            this.consolidatedCiData.downloadSucceeded = 'false';
            ci.publishEvent('DownloadFailed', { action: 'getLatestAvailableInCache', error: error } );
            this.consolidatedCiData.secondCacheLookupStartTime = perf();

            // Download failed, look for the latest version available in the cache
            vstestPlatformInstalledLocation = toolLib.findLocalTool(constants.toolFolderName, testPlatformVersion);

            this.consolidatedCiData.secondCacheLookupEndTime = perf();
            ci.publishEvent('CacheLookup', { CacheHit: (!helpers.isNullEmptyOrUndefined(vstestPlatformInstalledLocation)).toString(),
                isFallback: 'true', version: testPlatformVersion, startTime: this.consolidatedCiData.secondCacheLookupStartTime, 
                endTime: this.consolidatedCiData.secondCacheLookupEndTime } );

            // No version found in cache, fail the task
            if (!vstestPlatformInstalledLocation || vstestPlatformInstalledLocation === 'undefined') {
                this.consolidatedCiData.secondCacheLookupSucceeded = 'false';
                this.consolidatedCiData.failureReason = constants.downloadFailed;
                tl.error(tl.loc('NoPackageFoundInCache'));
                throw new Error(tl.loc('FailedToAcquireTestPlatform'));
            }

            this.consolidatedCiData.secondCacheLookupSucceeded = 'true';
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
            this.consolidatedCiData.agentWorkDirectoryPathTooLong = 'true';
            tl.warning(tl.loc('AgentWorkDirectoryPathTooLong'));
        }

        // Use as short a path as possible due to nested folders in the package that may potentially exceed the 255 char windows path limit
        downloadPath = path.join(downloadPath, constants.toolFolderName);
        nugetTool.arg(constants.install).arg(constants.packageId).arg(constants.version).arg(testPlatformVersion).arg(constants.source)
            .arg(packageSource).arg(constants.outputDirectory).arg(downloadPath).arg(constants.noCache).arg(constants.directDownload)
            .argIf(nugetConfigFilePath, constants.configFile).argIf(nugetConfigFilePath, nugetConfigFilePath);

        tl.debug(`Downloading Test Platform version ${testPlatformVersion} from ${packageSource} to ${downloadPath}.`);
        this.consolidatedCiData.downloadStartTime = perf();
        const resultCode = await nugetTool.exec();
        this.consolidatedCiData.downloadEndTime = perf();

        tl.debug(`Nuget.exe returned with result code ${resultCode}`);

        if (resultCode !== 0) {
            tl.error(tl.loc('NugetErrorCode', resultCode));
            throw new Error(tl.loc('DownloadFailed', resultCode));
        }

        ci.publishEvent('DownloadPackage', { version: testPlatformVersion, startTime: this.consolidatedCiData.downloadStartTime, 
            endTime: this.consolidatedCiData.downloadEndTime } );

        // Install into the local tool cache
        const toolRoot = path.join(downloadPath, constants.packageId + '.' + testPlatformVersion);

        tl.debug(`Caching the downloaded folder ${toolRoot}.`);
        this.consolidatedCiData.cacheStartTime = perf();
        const vstestPlatformInstalledLocation = await toolLib.cacheDir(toolRoot, constants.toolFolderName, testPlatformVersion);
        this.consolidatedCiData.cacheEndTime = perf();
        ci.publishEvent('CacheDownloadedPackage', { startTime: this.consolidatedCiData.cacheStartTime, 
            endTime: this.consolidatedCiData.cacheEndTime } );
        return vstestPlatformInstalledLocation;
    }
}