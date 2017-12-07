import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import * as constants from './Constants';
import * as tl from 'vsts-task-lib';

describe('VsTestPlatformToolInstaller Suite', function() {
    this.timeout(30000);

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
        delete process.env[constants.findLocalToolFirstCallReturnValue];
        delete process.env[constants.findLocalToolSecondCallReturnValue];
        delete process.env[constants.listPackagesReturnCode];
        done();
    });

    after(function () {
        //console.log('after');
    });

    it('Get latest version initial cache hit', (done: MochaDone) => {
        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = '15.6.0-preview-20171108-02';
        process.env[constants.findLocalToolFirstCallReturnValue] = `VsTest\\${process.env[constants.expectedTestPlatformVersion]}`;
        process.env[constants.listPackagesReturnCode] = 0;

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('LookingForLatestPreReleaseVersion'), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[constants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Cache hit for ${process.env[constants.expectedTestPlatformVersion]}`), `Expected a cache hit.`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

        done();
    });

    it('Get latest version cache miss but download success', (done: MochaDone) => {
        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.versionSelector] = 'latestPreRelease';
        process.env[constants.testPlatformVersion] = '';
        process.env[constants.downloadPath] = 'temp\\VsTest';
        process.env[constants.expectedTestPlatformVersion] = '15.6.0-preview-20171108-02';
        process.env[constants.listPackagesReturnCode] = 0;
        process.env[constants.downloadPackageReturnCode] = 0;

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('LookingForLatestPreReleaseVersion'), `Should have looked for latest pre-release version.`);
        assert(tr.stdOutContained(`Found the latest version to be ${process.env[constants.expectedTestPlatformVersion]}.`), `Should have found latest version to be ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Looking for version ${process.env[constants.expectedTestPlatformVersion]} in the tools cache.`), `Should have looked for ${process.env[constants.expectedTestPlatformVersion]} in the cache.`);
        assert(tr.stdOutContained(`Could not find Microsoft.TestPlatform.${process.env[constants.expectedTestPlatformVersion]} in the tools cache. Fetching it from nuget.`), `Should have encountered a cache miss for ${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained(`Downloading Test Platform version ${process.env[constants.expectedTestPlatformVersion]} from ${constants.packageSource} to ${process.env[constants.downloadPath]}.`), `Should have attempted download of version ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Caching the downloaded folder temp\\VsTest\\${constants.packageName}.${process.env[constants.expectedTestPlatformVersion]}.`), `Should have cached ${process.env[constants.expectedTestPlatformVersion]}`);
        assert(tr.stdOutContained(`Set variable VsTestToolsInstallerInstalledToolLocation value to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`), `Should have set variable to VsTest\\${process.env[constants.expectedTestPlatformVersion]}.`);
        assert(tr.stdOutContained('InstallationSuccessful'));

        done();
    });
});
