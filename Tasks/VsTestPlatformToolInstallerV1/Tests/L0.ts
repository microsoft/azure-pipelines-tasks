import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import * as constants from '../constants';
import * as testConstants from './TestConstants';
import * as tl from 'vsts-task-lib';

describe('VsTestPlatformToolInstaller Suite', function() {
    this.timeout(10000);

    if (!tl.osType().match(/^Win/)) {
        return;
    }

    before((done) => {
        done();
    });

    beforeEach((done) => {
        // Clear all inputs and other environment variables
        delete process.env[constants.vsTestToolsInstallerInstalledToolLocation];
        delete process.env[constants.versionSelector];
        delete process.env[constants.testPlatformVersion];
        delete process.env[constants.downloadPath];
        delete process.env[constants.expectedTestPlatformVersion];
        delete process.env[testConstants.findLocalToolFirstCallReturnValue];
        delete process.env[testConstants.findLocalToolSecondCallReturnValue];
        delete process.env[testConstants.listPackagesReturnCode];
        delete process.env[testConstants.listPackagesOutput];

        process.env[constants.packageFeedSelector] = constants.nugetOrg;

        done();
    });

    after(function () {
        //console.log('after');
    });

    it('Get latest pre-release version cache hit', (done: MochaDone) => {
        console.log('TestCaseName: Get latest pre-release version cache hit');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = '15.6.0-preview-20171108-02';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[constants.expectedTestPlatformVersion]}`;
        process.env[testConstants.listPackagesReturnCode] = 0;

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[constants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[constants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

        done();
    });

    it('Get latest pre-release version cache miss and download success', (done: MochaDone) => {
        console.log('TestCaseName: Get latest pre-release version cache miss and download success');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = '15.6.0-preview-20171108-02';
        process.env[testConstants.listPackagesReturnCode] = 0;
        process.env[testConstants.downloadPackageReturnCode] = 0;

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[constants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[constants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Downloading Test Platform version ${process.env[constants.expectedTestPlatformVersion]} from ${constants.defaultPackageSource} to ${process.env[constants.downloadPath]}.`), `Should have attempted download of version ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Caching the downloaded folder temp\\VsTest\\${constants.packageId}.${process.env[constants.expectedTestPlatformVersion]}.`), `Should have cached ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

        done();
    });

    it('Get latest pre-release version listing failed but a stable version found in cache', (done: MochaDone) => {
        console.log('TestCaseName: Get latest pre-release version listing failed but a stable version found in cache');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = 'x';
        process.env[testConstants.listPackagesReturnCode] = 1;
        process.env[testConstants.downloadPackageReturnCode] = 0;
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\15.6.0`;

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`FailedToListAvailablePackagesFromNuget`), `Listing packages should have failed.`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[constants.expectedTestPlatformVersion]}`), `Should have been a cache hit for ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to ${process.env[testConstants.findLocalToolFirstCallReturnValue]}.`), `Should have set variable to ${process.env[testConstants.findLocalToolFirstCallReturnValue]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

        done();
    });

    it('Get latest pre-release version listing failed but no stable version found in cache', (done: MochaDone) => {
        console.log('TestCaseName: Get latest pre-release version listing failed but no stable version found in cache');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[testConstants.listPackagesReturnCode] = 1;
        process.env[testConstants.downloadPackageReturnCode] = 0;
        process.env[testConstants.expectedTestPlatformVersion] = 'x';

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length !== 0 || tr.errorIssues.length, 'should have written to stderr');
        assert(tr.failed, `Task should have failed`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`FailedToListAvailablePackagesFromNuget`), `Listing packages should have failed.`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache miss for ${process.env[constants.expectedTestPlatformVersion]}`), `Should have been a cache miss for ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained('NoPackageFoundInCache'), `Should warn no stable package found in cache`);
        assert(tr.stdOutContained('FailedToAcquireTestPlatform'), `Should fail with failed to acquire test platform`);

        done();
    });

    it('Get latest pre-release version cache miss and download failed but fallback cache hit', (done: MochaDone) => {
        console.log('TestCaseName: Get latest pre-release version cache miss and download failed but fallback cache hit');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = '15.6.0-preview-20171108-02';
        process.env[testConstants.listPackagesReturnCode] = 0;
        process.env[testConstants.downloadPackageReturnCode] = 1;
        process.env[testConstants.findLocalToolSecondCallReturnValue] = `VsTest\\15.6.0`;

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[constants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[constants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Downloading Test Platform version ${process.env[constants.expectedTestPlatformVersion]} from ${constants.defaultPackageSource} to ${process.env[constants.downloadPath]}.`), `Should have attempted download of version ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`TestPlatformDownloadFailed`), `Download should have failed`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to ${process.env[testConstants.findLocalToolSecondCallReturnValue]}.`), `Should have set variable to ${process.env[testConstants.findLocalToolSecondCallReturnValue]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

        done();
    });

    it('Get latest pre-release version cache miss and download failed and fallback cache miss', (done: MochaDone) => {
        console.log('TestCaseName: Get latest pre-release version cache miss and download failed and fallback cache miss');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = '15.6.0-preview-20171108-02';
        process.env[testConstants.listPackagesReturnCode] = 0;
        process.env[testConstants.downloadPackageReturnCode] = 1;

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length !== 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.failed, `Task should have failed`);
        assert(tr.stdOutContained(`LookingForLatestPreReleaseVersion`), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[constants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[constants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Downloading Test Platform version ${process.env[constants.expectedTestPlatformVersion]} from ${constants.defaultPackageSource} to ${process.env[constants.downloadPath]}.`), `Should have attempted download of version ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`TestPlatformDownloadFailed`), `Download should have failed`);
        process.env[constants.expectedTestPlatformVersion] = 'x';
        assert(tr.stdOutContained(`Cache miss for ${process.env[constants.expectedTestPlatformVersion]}`), `Should have been a cache miss for ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained('NoPackageFoundInCache'), `Should warn no stable package found in cache`);
        assert(tr.stdOutContained('FailedToAcquireTestPlatform'), `Should fail with failed to acquire test platform`);

        done();
    });

    it('Get latest stable version cache hit', (done: MochaDone) => {
        console.log('TestCaseName: Get latest stable version cache hit');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'latestStable';
        process.env[constants.testPlatformVersion] = '';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = '15.6.0';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[constants.expectedTestPlatformVersion]}`;
        process.env[testConstants.listPackagesReturnCode] = 0;

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestStableVersion`), `Should have looked for latest stable version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[constants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[constants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

        done();
    });

    it('Get latest stable version listing empty and cache hit', (done: MochaDone) => {
        console.log('TestCaseName: Get latest stable version listing empty and cache hit');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'latestStable';
        process.env[constants.testPlatformVersion] = '';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = 'x';
        process.env[testConstants.listPackagesReturnCode] = 0;
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\15.6.0`;
        process.env[testConstants.listPackagesOutput] = '';

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`LookingForLatestStableVersion`), `Should have looked for latest stable version.`);
        assert(tr.stdOutContained(`FailedToListAvailablePackagesFromNuget`), `Listing packages should have failed.`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[constants.expectedTestPlatformVersion]}`), `Should have been a cache hit for ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to ${process.env[testConstants.findLocalToolFirstCallReturnValue]}.`), `Should have set variable to ${process.env[testConstants.findLocalToolFirstCallReturnValue]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

        done();
    });

    it('Get specific version cache hit', (done: MochaDone) => {
        console.log('TestCaseName: Get specific version cache hit');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'specificVersion';
        process.env[constants.testPlatformVersion] = '15.6.0-preview-20171108-02';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = '15.6.0-preview-20171108-02';
        process.env[testConstants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[constants.expectedTestPlatformVersion]}`;

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[constants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

        done();
    });

    it('Get specific version cache miss and download success', (done: MochaDone) => {
        console.log('TestCaseName: Get specific version cache miss and download success');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'specificVersion';
        process.env[constants.testPlatformVersion] = '15.6.0-preview-20171108-02';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = '15.6.0-preview-20171108-02';
        process.env[testConstants.downloadPackageReturnCode] = 0;

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[constants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Downloading Test Platform version ${process.env[constants.expectedTestPlatformVersion]} from ${constants.defaultPackageSource} to ${process.env[constants.downloadPath]}.`), `Should have attempted download of version ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Caching the downloaded folder temp\\VsTest\\${constants.packageId}.${process.env[constants.expectedTestPlatformVersion]}.`), `Should have cached ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

        done();
    });
});
