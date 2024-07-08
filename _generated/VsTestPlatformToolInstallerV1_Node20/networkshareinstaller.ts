import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';
import * as helpers from './helpers';
import { NugetDownloadHelper } from './nugetdownloadhelper';

let startTime: number;

export class NetworkShareInstaller {
    // Installs the test platform from a network share path provided by the user. The path should point to a .nupkg file.
    public async installVsTestPlatformToolFromNetworkShare(netSharePath: string) {
        let vstestPlatformInstalledLocation;
        let packageSource;

        // Remove all double quotes from the path.
        netSharePath = netSharePath.replace(/["]+/g, '');

        tl.debug(`Attempting to fetch the vstest platform from the specified network share path ${netSharePath}.`);

        if (helpers.pathExistsAsFile(netSharePath)) {
            packageSource = path.dirname(netSharePath);
        } else {
            ci.addToConsolidatedCi('failureReason', constants.packageFileDoesNotExist);
            throw new Error(tl.loc('SpecifiedFileDoesNotExist', netSharePath));
        }

        const fileName = path.basename(netSharePath);
        const versionExtractionRegex = constants.versionExtractionRegex;
        const regexMatches = versionExtractionRegex.exec(fileName);

        if (!regexMatches || regexMatches.length !== 2) {
            ci.addToConsolidatedCi('failureReason', constants.unexpectedPackageFileName);
            throw new Error(tl.loc('UnexpectedFileName', fileName));
        }
        const testPlatformVersion = regexMatches[1];
        ci.addToConsolidatedCi('testPlatformVersion', testPlatformVersion);

        // If the version provided is not an explicit version (ie contains containing wildcards) then throw
        if (!toolLib.isExplicitVersion(testPlatformVersion)) {
            ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
            ci.addToConsolidatedCi('failureReason', constants.notExplicitVersion);
            throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
        }

        console.log(tl.loc('ParsedVersion', testPlatformVersion));
        tl.debug(`Looking for version ${testPlatformVersion} in the tools cache.`);
        startTime = perf();

        // Check cache for the specified version
        vstestPlatformInstalledLocation = toolLib.findLocalTool(constants.toolFolderName, testPlatformVersion);

        ci.addToConsolidatedCi('cacheLookupTime', perf() - startTime);

        // If found in the cache then set the tool location and return
        if (!helpers.isNullEmptyOrUndefined(vstestPlatformInstalledLocation)) {
            ci.addToConsolidatedCi('firstCacheLookupSucceeded', 'true');
            helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
            return;
        }

        ci.addToConsolidatedCi('firstCacheLookupSucceeded', 'false');

        vstestPlatformInstalledLocation = await new NugetDownloadHelper()
            .attemptPackageDownload(packageSource, testPlatformVersion, null);

        // Set the vstest platform tool location for the vstest task to consume
        helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
    }
}