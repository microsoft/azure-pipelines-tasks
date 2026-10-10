import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as constants from '../constants';
import * as testConstants from './TestConstants';
import * as tl from 'azure-pipelines-task-lib';

describe('VsTestPlatformToolInstaller Suite', function() {
    this.timeout(10000);

    if (!tl.osType().match(/^Win/)) {
        return;
    }

    before(() => {
    });

    beforeEach(() => {
        // Clear all inputs and other environment variables
        delete process.env[constants.vsTestToolsInstallerInstalledToolLocation];
        delete process.env[constants.versionSelector];
        delete process.env[constants.testPlatformVersion];
        delete process.env[constants.downloadPath];
        delete process.env[testConstants.expectedTestPlatformVersion];
        delete process.env[testConstants.findLocalToolFirstCallReturnValue];
        delete process.env[testConstants.findLocalToolSecondCallReturnValue];
        delete process.env[testConstants.listPackagesReturnCode];
        delete process.env[testConstants.listPackagesOutput];
        delete process.env[constants.username];
        delete process.env[constants.password];
        delete process.env[testConstants.feedId];
        delete process.env[constants.packageFeedSelector];
        delete process.env[constants.customFeed];
        delete process.env[testConstants.packageSource];
        delete process.env[testConstants.configFile];

        process.env[constants.packageFeedSelector] = constants.nugetOrg;
        process.env[testConstants.packageSource] = constants.defaultPackageSource;
        process.env[testConstants.writeNugetConfigReturnCode] = '0';
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.downloadPath] = `${process.env[constants.agentTempDirectory]}\\VsTest`;

    });

    after(function () {
        // add code for cleanup if any
    });

    // *************************************************** Nuget Org Tests ******************************************************

    it('Get latest pre-release version cache hit', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}`;
        process.env[testConstants.listPackagesReturnCode] = '0';

        // Start the run
        await tr.runAsync();
        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get latest pre-release version cache miss and download success', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.listPackagesReturnCode] = '0';
        process.env[testConstants.downloadPackageReturnCode] = '0';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Downloading Test Platform version ${process.env[testConstants.expectedTestPlatformVersion]} from ${process.env[testConstants.packageSource]} to ${process.env[constants.downloadPath]}.`), `Should have attempted download of version ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Caching the downloaded folder temp\\VsTest\\${constants.packageId}.${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have cached ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get latest pre-release version listing failed but a stable version found in cache', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = 'x';
        process.env[testConstants.listPackagesReturnCode] = '1';
        process.env[testConstants.downloadPackageReturnCode] = '0';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\17.5.0`;

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`FailedToListAvailablePackagesFromNuget`), `Listing packages should have failed.`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Should have been a cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to ${process.env[testConstants.findLocalToolFirstCallReturnValue]}.`), `Should have set variable to ${process.env[testConstants.findLocalToolFirstCallReturnValue]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get latest pre-release version listing failed but no stable version found in cache', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.listPackagesReturnCode] = '1';
        process.env[testConstants.downloadPackageReturnCode] = '0';
        process.env[testConstants.expectedTestPlatformVersion] = 'x';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length !== 0 || tr.errorIssues.length, 'should have written to stderr');
        assert(tr.failed, `Task should have failed`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`FailedToListAvailablePackagesFromNuget`), `Listing packages should have failed.`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Should have been a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained('NoPackageFoundInCache'), `Should warn no stable package found in cache`);
        assert(tr.stdOutContained('FailedToAcquireTestPlatform'), `Should fail with failed to acquire test platform`);

    });

    it('Get latest pre-release version cache miss and download failed but fallback cache hit', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.listPackagesReturnCode] = '0';
        process.env[testConstants.downloadPackageReturnCode] = '1';
        process.env[testConstants.findLocalToolSecondCallReturnValue] = `VsTest\\17.5.0`;

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Downloading Test Platform version ${process.env[testConstants.expectedTestPlatformVersion]} from ${process.env[testConstants.packageSource]} to ${process.env[constants.downloadPath]}.`), `Should have attempted download of version ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`TestPlatformDownloadFailed`), `Download should have failed`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to ${process.env[testConstants.findLocalToolSecondCallReturnValue]}.`), `Should have set variable to ${process.env[testConstants.findLocalToolSecondCallReturnValue]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get latest pre-release version cache miss and download failed and fallback cache miss', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.listPackagesReturnCode] = '0';
        process.env[testConstants.downloadPackageReturnCode] = '1';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length !== 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.failed, `Task should have failed`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Downloading Test Platform version ${process.env[testConstants.expectedTestPlatformVersion]} from ${process.env[testConstants.packageSource]} to ${process.env[constants.downloadPath]}.`), `Should have attempted download of version ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`TestPlatformDownloadFailed`), `Download should have failed`);
        process.env[testConstants.expectedTestPlatformVersion] = 'x';
        assert(tr.stdOutContained(`Cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Should have been a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained('NoPackageFoundInCache'), `Should warn no stable package found in cache`);
        assert(tr.stdOutContained('FailedToAcquireTestPlatform'), `Should fail with failed to acquire test platform`);

    });

    it('Get latest stable version cache hit', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.versionSelector] = 'latestStable';
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}`;
        process.env[testConstants.listPackagesReturnCode] = '0';

        // Start the run
        await tr.runAsync();
        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestStableVersion`), `Should have looked for latest stable version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get latest stable version listing empty and cache hit', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.versionSelector] = 'latestStable';
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = 'x';
        process.env[testConstants.listPackagesReturnCode] = '0';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\17.5.0`;
        process.env[testConstants.listPackagesOutput] = '';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestStableVersion`), `Should have looked for latest stable version.`);
        assert(tr.stdOutContained(`FailedToListAvailablePackagesFromNuget`), `Listing packages should have failed.`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Should have been a cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to ${process.env[testConstants.findLocalToolFirstCallReturnValue]}.`), `Should have set variable to ${process.env[testConstants.findLocalToolFirstCallReturnValue]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get specific version cache hit', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.versionSelector] = 'specificVersion';
        process.env[constants.testPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}`;

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get specific version cache miss and download success', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.versionSelector] = 'specificVersion';
        process.env[constants.testPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.downloadPackageReturnCode] = '0';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Downloading Test Platform version ${process.env[testConstants.expectedTestPlatformVersion]} from ${process.env[testConstants.packageSource]} to ${process.env[constants.downloadPath]}.`), `Should have attempted download of version ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Caching the downloaded folder temp\\VsTest\\${constants.packageId}.${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have cached ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    // ***************************************************** Custom Feed Tests *************************************************************

    it('Get latest pre-release version cache hit from custom feed no password', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.packageFeedSelector] = constants.customFeed;
        process.env[constants.customFeed] = 'somecustomfeed';
        process.env[testConstants.packageSource] = 'somecustomfeed';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}`;
        process.env[testConstants.listPackagesReturnCode] = '0';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get latest pre-release version cache hit from custom feed and password provided', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.password] = 'pattoken';
        process.env[testConstants.feedId] = 'somefeedid';
        process.env[constants.packageFeedSelector] = constants.customFeed;
        process.env[constants.customFeed] = 'somecustomfeed';
        process.env[testConstants.packageSource] = 'somefeedid';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[testConstants.configFile] = `${process.env[constants.agentTempDirectory]}\\somefeedid.config`;
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}`;
        process.env[testConstants.listPackagesReturnCode] = '0';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get latest pre-release version cache hit from custom feed username and password provided', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.username] = 'someuser';
        process.env[constants.password] = 'pattoken';
        process.env[testConstants.feedId] = 'somefeedid';
        process.env[constants.packageFeedSelector] = constants.customFeed;
        process.env[constants.customFeed] = 'somecustomfeed';
        process.env[testConstants.packageSource] = 'somefeedid';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[testConstants.configFile] = `${process.env[constants.agentTempDirectory]}\\somefeedid.config`;
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}`;
        process.env[testConstants.listPackagesReturnCode] = '0';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(constants.emptyNugetConfig), `Should have written skeleton nuget config file contents.`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Deleted file ${process.env[testConstants.configFile]}`), `Should have cleaned up the temp config file.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get latest pre-release version cache miss and download success for custom feed with password', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.password] = 'pattoken';
        process.env[testConstants.feedId] = 'somefeedid';
        process.env[constants.packageFeedSelector] = constants.customFeed;
        process.env[constants.customFeed] = 'somecustomfeed';
        process.env[testConstants.packageSource] = 'somefeedid';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[testConstants.configFile] = `${process.env[constants.agentTempDirectory]}\\somefeedid.config`;
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.listPackagesReturnCode] = '0';
        process.env[testConstants.downloadPackageReturnCode] = '0';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Downloading Test Platform version ${process.env[testConstants.expectedTestPlatformVersion]} from ${process.env[testConstants.packageSource]} to ${process.env[constants.downloadPath]}.`), `Should have attempted download of version ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Caching the downloaded folder temp\\VsTest\\${constants.packageId}.${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have cached ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get latest pre-release version cache hit from custom feed, password provided but writing config fails', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.password] = 'pattoken';
        process.env[testConstants.feedId] = 'somefeedid';
        process.env[constants.packageFeedSelector] = constants.customFeed;
        process.env[constants.customFeed] = 'somecustomfeed';
        process.env[testConstants.packageSource] = 'somefeedid';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[testConstants.configFile] = `${process.env[constants.agentTempDirectory]}\\somefeedid.config`;
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = 'x';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}`;
        process.env[testConstants.listPackagesReturnCode] = '0';
        process.env[testConstants.writeNugetConfigReturnCode] = '1';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length !== 0 || tr.errorIssues.length, 'should have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`ConfigFileWriteFailed`), `Config file write should have failed and error message for it shown.`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get latest pre-release version cache hit from custom feed, password provided but writing config fails and fallback cache lookup fails', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.password] = 'pattoken';
        process.env[testConstants.feedId] = 'somefeedid';
        process.env[constants.packageFeedSelector] = constants.customFeed;
        process.env[constants.customFeed] = 'somecustomfeed';
        process.env[testConstants.packageSource] = 'somefeedid';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[testConstants.configFile] = `${process.env[constants.agentTempDirectory]}\\somefeedid.config`;
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.expectedTestPlatformVersion] = 'x';
        process.env[testConstants.listPackagesReturnCode] = '0';
        process.env[testConstants.writeNugetConfigReturnCode] = '1';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length !== 0 || tr.errorIssues.length, 'should have written to stderr');
        assert(tr.failed, `Task should have failed`);
        assert(tr.stdOutContained(`ConfigFileWriteFailed`), `Config file write should have failed and error message for it shown.`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Should have been a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained('NoPackageFoundInCache'), `Should warn no stable package found in cache`);
        assert(tr.stdOutContained('FailedToAcquireTestPlatform'), `Should fail with failed to acquire test platform`);

    });

    // ***************************************************** Network Share Tests *************************************************************

    it('Get specified package from path provided from network share cache hit', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.packageFeedSelector] = constants.netShare;
        process.env[testConstants.packageSource] = '\\somesharepath';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}`;
        process.env[constants.netShare] = `\\\\somesharepath\\Microsoft.Testplatform.${process.env[testConstants.expectedTestPlatformVersion]}.nupkg`;
        process.env[testConstants.listPackagesReturnCode] = '0';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get specified package from path provided from network share cache miss and copy successful', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.packageFeedSelector] = constants.netShare;
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[constants.netShare] = `\\\\somesharepath\\Microsoft.Testplatform.${process.env[testConstants.expectedTestPlatformVersion]}.nupkg`;
        process.env[testConstants.packageSource] = process.env[constants.netShare];
        process.env[testConstants.listPackagesReturnCode] = '0';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get specified package from path provided from network share cache miss share and copy unsuccessful but fallback cache lookup successful', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.packageFeedSelector] = constants.netShare;
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[constants.netShare] = `\\\\somesharepath\\Microsoft.Testplatform.${process.env[testConstants.expectedTestPlatformVersion]}.nupkg`;
        process.env[testConstants.packageSource] = process.env[constants.netShare];
        process.env[testConstants.listPackagesReturnCode] = '0';
        process.env[testConstants.downloadPackageReturnCode] = '1';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = ``;
        process.env[testConstants.findLocalToolSecondCallReturnValue] = `VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}`;

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

    });

    it('Get specified package from path provided from network share cache miss and copy unsuccessful and fallback cache lookup unsuccessful', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.packageFeedSelector] = constants.netShare;
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[constants.netShare] = `\\\\somesharepath\\Microsoft.Testplatform.${process.env[testConstants.expectedTestPlatformVersion]}.nupkg`;
        process.env[testConstants.packageSource] = process.env[constants.netShare];
        process.env[testConstants.listPackagesReturnCode] = '0';
        process.env[testConstants.downloadPackageReturnCode] = '1';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.failed, `Task should have succeeded`);
        assert(tr.stdOutContained(`Looking for version ${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[testConstants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[testConstants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}`), `Should have been a cache miss for ${process.env[testConstants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained('NoPackageFoundInCache'), `Should warn no stable package found in cache`);
        assert(tr.stdOutContained('FailedToAcquireTestPlatform'), `Should fail with failed to acquire test platform`);

    });

    it('Get specified package from path provided from network share invalid filename', async () => {

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.packageFeedSelector] = constants.netShare;
        process.env[testConstants.packageSource] = '\\somesharepath';
        process.env[testConstants.expectedTestPlatformVersion] = '17.5.0-preview-20221003-04';
        process.env[constants.netShare] = `\\\\somesharepath\\Miiiicrosoft.Testplatform.${process.env[testConstants.expectedTestPlatformVersion]}.nupkg`;
        process.env[testConstants.listPackagesReturnCode] = '0';

        // Start the run
        await tr.runAsync();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.failed, `Task should have failed`);
        assert(tr.stdOutContained(`UnexpectedFileName`));

    });
});