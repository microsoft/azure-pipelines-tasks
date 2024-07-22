import * as tl from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as path from 'path';
import { exec } from 'child_process';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';
import * as helpers from './helpers';
import * as uuid from 'uuid';
import * as fs from 'fs';
import { NugetPackageVersionHelper } from './nugetpackageversionhelper';
import { NugetDownloadHelper } from './nugetdownloadhelper';
import { async } from 'q';

let startTime: number;

export class NugetFeedInstaller {
    // Installs the test platform from a custom feed provided by the user along with credentials for authentication against said feed
    public async installVsTestPlatformToolFromCustomFeed(packageSource: string, versionSelectorInput: string, testPlatformVersion: string, username: string, password: string) {
        let tempConfigFilePath = null;
        try {
            try {
                if (!helpers.isNullEmptyOrUndefined(password)) {
                    tl.debug('Attempting to write feed details along with provided credentials to temporary config file.');
                    tempConfigFilePath = helpers.GenerateTempFile(`${uuid.v1()}.config`);
                    const feedId = uuid.v1();
                    this.prepareNugetConfigFile(packageSource, tempConfigFilePath, username, password, feedId);
                    packageSource = feedId;
                    ci.addToConsolidatedCi('passwordProvided', 'true');
                    ci.addToConsolidatedCi('usernameProvided', `${!helpers.isNullEmptyOrUndefined(username)}`);
                } else {
                    packageSource = tl.getInput(constants.customFeed);
                    tl.debug(`Credentials were not provided. Skipping writing to config file. Will use custom package feed provided by user ${packageSource}`);
                }
            } catch (error) {
                tl.error(error);
                console.log(tl.loc('LatestStableCached'));
                // Look for the latest stable version available in the cache as a fallback.
                testPlatformVersion = 'x';
                tempConfigFilePath = null;
            }

            await this.installVsTestPlatformToolFromSpecifiedFeed(packageSource, testPlatformVersion, versionSelectorInput, tempConfigFilePath);

        } finally {
            helpers.cleanUpTempConfigFile(tempConfigFilePath);
        }
    }

    // Installs the test platform from the feed specified. If platfornVersion is null then the versionSelectorInput is read and the version
    // is determined accordingly. Additionally provide the config file to help with authentication if the feed is a custom feed.
    public async installVsTestPlatformToolFromSpecifiedFeed(packageSource: string, testPlatformVersion: string, versionSelectorInput: string, nugetConfigFilePath: string) {
        let vstestPlatformInstalledLocation: string;
        let includePreRelease: boolean;

        ci.addToConsolidatedCi('versionSelectorInput', versionSelectorInput);
        tl.debug(`Using the package source ${packageSource} to get the ${constants.packageId} nuget package.`);

        if (!helpers.isNullEmptyOrUndefined(nugetConfigFilePath)) {
            tl.debug(`Using provided config file ${nugetConfigFilePath}.`);
        }

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
                ci.addToConsolidatedCi('latestVersionIdentified', 'false');
                testPlatformVersion = new NugetPackageVersionHelper()
                    .getLatestPackageVersionNumber(packageSource, includePreRelease, nugetConfigFilePath);

                if (helpers.isNullEmptyOrUndefined(testPlatformVersion)) {

                    tl.warning(tl.loc('RequiredVersionNotListed'));
                    tl.debug('Looking for latest stable available version in cache.');
                    ci.publishEvent('RequestedVersionNotListed', { action: 'getLatestAvailableInCache' } );
                    // Look for the latest stable version available in the cache
                    testPlatformVersion = 'x';

                } else {
                    ci.addToConsolidatedCi('latestVersionIdentified', 'true');
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

        // If the testPlatformVersion is 'x' meaning listing failed and we were looking for a stable version in the cache
        // and the cache lookup failed, then fail the task
        if (!testPlatformVersion || testPlatformVersion === 'x') {
            tl.error(tl.loc('NoPackageFoundInCache'));
            ci.addToConsolidatedCi('failureReason', constants.listingFailed);
            throw new Error(tl.loc('FailedToAcquireTestPlatform'));
        }

        // If the version provided is not an explicit version (ie contains containing wildcards) then throw
        if (!toolLib.isExplicitVersion(testPlatformVersion)) {
            ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
            ci.addToConsolidatedCi('failureReason', constants.notExplicitVersion);
            throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
        }

        vstestPlatformInstalledLocation = await new NugetDownloadHelper()
            .attemptPackageDownload(packageSource, testPlatformVersion, nugetConfigFilePath);

        // Set the vstest platform tool location for the vstest task to consume
        helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
    }

    // Utility function that writes the feed url along with username and password if provided into the specified nuget config file
    private prepareNugetConfigFile(packageSource: string, configFilePath: string, username: string, password: string, feedId: string) {
        const feedUrl = tl.getInput(constants.customFeed);

        tl.debug(`Writing package source details to temp config file ${configFilePath}`);

        try {
            // Write the skeleton nuget config contents to the config file
            fs.writeFileSync(configFilePath, constants.emptyNugetConfig, { encoding: 'utf-8' });
        } catch (error) {
            ci.addToConsolidatedCi('failureReason', 'configFileWriteFailed');
            throw new Error(tl.loc('ConfigFileWriteFailed', configFilePath, error));
        }

        if (!helpers.isNullEmptyOrUndefined(password) && helpers.isNullEmptyOrUndefined(username)) {
            username = constants.defaultUsername;
        }

        const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));

        nugetTool.arg(constants.sources).arg(constants.add).arg(constants.noninteractive)
            .arg(constants.name).arg(feedId).arg(constants.source).arg(feedUrl)
            .arg(constants.validAuthenticationTypes).arg(constants.basic)
            .argIf(password, constants.usernameParam).argIf(password, username)
            .argIf(password, constants.passwordParam).argIf(password, password)
            .argIf(configFilePath, constants.configFile).argIf(configFilePath, configFilePath);

        startTime = perf();
        const result = nugetTool.execSync();
        ci.addToConsolidatedCi('prepareConfigFileTime', perf() - startTime);

        if (result.code !== 0 || !(result.stderr === null || result.stderr === undefined || result.stderr === '')) {
            ci.addToConsolidatedCi('failureReason', constants.configFileWriteFailed);
            throw new Error(tl.loc('ConfigFileWriteFailed', configFilePath, result.stderr));
        }

        // Assign the feed name we wrote into the config file to the packageSource variable
        tl.debug(`Setting the source to feed with id ${feedId} whose details were written to the config file.`);
        ci.publishEvent('PackageSourceOverridden', {packageSource: 'customFeed'} );
    }
}