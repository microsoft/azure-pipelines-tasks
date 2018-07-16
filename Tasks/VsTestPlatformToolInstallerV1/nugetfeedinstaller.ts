import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as path from 'path';
import { exec } from 'child_process';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';
import * as helpers from './helpers';
import { NugetPackageVersionHelper } from './nugetpackageversionhelper';
import { NugetDownloadHelper } from './nugetdownloadhelper';
import { async } from 'q';

export class NugetFeedInstaller {
    public consolidatedCiData: { [key: string]: string; } = <{ [key: string]: string; }>{};

    public constructor(consolidatedCiData: { [key: string]: string; }) {
        this.consolidatedCiData = consolidatedCiData;
    }

    // Installs the test platform from the feed specified. If platfornVersion is null then the versionSelectorInput is read and the version
    // is determined accordingly. Additionally provide the config file to help with authentication if the feed is a custom feed.
    public async getVsTestPlatformToolFromSpecifiedFeed(packageSource: string, testPlatformVersion: string, versionSelectorInput: string, nugetConfigFilePath: string) {
        let vstestPlatformInstalledLocation: string;
        let includePreRelease: boolean;

        this.consolidatedCiData.versionSelectorInput = versionSelectorInput;
        tl.debug(`Using the package source ${packageSource} to get the ${constants.packageId} nuget package.`);

        if (versionSelectorInput.toLowerCase() === constants.latestStable) {
            console.log(tl.loc('LookingForLatestStableVersion'));
            testPlatformVersion = null;
            includePreRelease = false;

        } else if (versionSelectorInput.toLowerCase() === constants.latestPrerelease) {
            console.log(tl.loc('LookingForLatestPreReleaseVersion'));
            testPlatformVersion = null;
            includePreRelease = true;
        }

        if (versionSelectorInput.toLowerCase() !== constants.specificVersion) {

            try {
                this.consolidatedCiData.latestVersionIdentified = 'false';
                testPlatformVersion = new NugetPackageVersionHelper(this.consolidatedCiData)
                    .getLatestPackageVersionNumber(packageSource, includePreRelease, nugetConfigFilePath);

                if (helpers.isNullEmptyOrUndefined(testPlatformVersion)) {

                    tl.warning(tl.loc('RequiredVersionNotListed'));
                    tl.debug('Looking for latest stable available version in cache.');
                    ci.publishEvent('RequestedVersionNotListed', { action: 'getLatestAvailableInCache' } );
                    // Look for the latest stable version available in the cache
                    testPlatformVersion = 'x';

                } else {
                    this.consolidatedCiData.latestVersionIdentified = 'true';
                    tl.debug(`Found the latest version to be ${testPlatformVersion}.`);
                    ci.publishEvent('RequestedVersionListed', { action: 'lookInCacheForListedVersion', version: testPlatformVersion } );
                }

            } catch (error) {
                // Failed to list available versions, look for the latest stable version available in the cache
                tl.error(`${tl.loc('FailedToListAvailablePackagesFromNuget')}\n${error}`);
                tl.debug('Looking for latest stable version available version in cache.');
                ci.publishEvent('RequestedVersionListFailed', { action: 'getLatestAvailableInCache', error: error } );
                testPlatformVersion = 'x';
            }
        }

        tl.debug(`Looking for version ${testPlatformVersion} in the tools cache.`);
        this.consolidatedCiData.cacheLookupStartTime = perf();

        // Check cache for the specified version
        vstestPlatformInstalledLocation = toolLib.findLocalTool(constants.toolFolderName, testPlatformVersion);

        this.consolidatedCiData.cacheLookupEndTime = perf();
        ci.publishEvent('CacheLookup', { CacheHit: (!helpers.isNullEmptyOrUndefined(vstestPlatformInstalledLocation)).toString(),
            isFallback: 'false', version: testPlatformVersion, startTime: this.consolidatedCiData.cacheLookupStartTime, 
            endTime: this.consolidatedCiData.cacheLookupEndTime } );

        // If found in the cache then set the tool location and return
        if (!helpers.isNullEmptyOrUndefined(vstestPlatformInstalledLocation)) {
            this.consolidatedCiData.firstCacheLookupSucceeded = 'true';
            helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
            return;
        }

        this.consolidatedCiData.firstCacheLookupSucceeded = 'false';

        // If the testPlatformVersion is 'x' meaning listing failed and we were looking for a stable version in the cache
        // and the cache lookup failed, then fail the task
        if (!testPlatformVersion || testPlatformVersion === 'x') {
            tl.error(tl.loc('NoPackageFoundInCache'));
            this.consolidatedCiData.failureReason = constants.listingFailed;
            throw new Error(tl.loc('FailedToAcquireTestPlatform'));
        }

        // If the version provided is not an explicit version (ie contains containing wildcards) then throw
        if (!toolLib.isExplicitVersion(testPlatformVersion)) {
            ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
            this.consolidatedCiData.failureReason = constants.notExplicitVersion;
            throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
        }

        vstestPlatformInstalledLocation = await new NugetDownloadHelper(this.consolidatedCiData)
            .attemptPackageDownload(packageSource, testPlatformVersion);

        // Set the vstest platform tool location for the vstest task to consume
        helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
    }
}