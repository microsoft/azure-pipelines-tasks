import * as tl from 'vsts-task-lib/task';
import * as path from 'path';
import * as toolLib from 'vsts-task-tool-lib/tool';
import { exec } from 'child_process';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';
import * as helpers from './helpers';
import { NugetDownloadHelper } from './nugetdownloadhelper';

export class NetworkShareInstaller {
    private consolidatedCiData: { [key: string]: string; } = <{ [key: string]: string; }>{};

    public constructor(consolidatedCiData: { [key: string]: string; }) {
        this.consolidatedCiData = consolidatedCiData;
    }

    // Installs the test platform from a network share path provided by the user. The path should point to a .nupkg file.
    public async getVsTestPlatformToolFromNetworkShare(netSharePath: string) {
        let vstestPlatformInstalledLocation;
        let packageSource;

        tl.debug(`Attempting to fetch the vstest platform from the specified network share path ${netSharePath}.`);

        if (helpers.pathExistsAsFile(netSharePath)) {
            packageSource = path.dirname(netSharePath);
        } else {
            this.consolidatedCiData.failureReason = constants.packageFileDoesNotExist;
            throw new Error(tl.loc('SpecifiedFileDoesNotExist', netSharePath));
        }

        const fileName = path.basename(netSharePath);
        const versionExtractionRegex = constants.versionExtractionRegex;
        const regexMatches = versionExtractionRegex.exec(fileName);

        if (regexMatches.length !== 2) {
            this.consolidatedCiData.failureReason = constants.unexpectedPackageFileName;
            throw new Error(tl.loc('UnexpectedFileName', fileName));
        }
        const testPlatformVersion = regexMatches[1];
        this.consolidatedCiData.testPlatformVersion = testPlatformVersion;

        // If the version provided is not an explicit version (ie contains containing wildcards) then throw
        if (!toolLib.isExplicitVersion(testPlatformVersion)) {
            ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
            this.consolidatedCiData.failureReason = constants.notExplicitVersion;
            throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
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

        vstestPlatformInstalledLocation = await new NugetDownloadHelper(this.consolidatedCiData)
            .attemptPackageDownload(packageSource, testPlatformVersion);

        // Set the vstest platform tool location for the vstest task to consume
        helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
    }
}