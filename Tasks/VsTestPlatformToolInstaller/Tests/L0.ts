import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
//import * as shared from './TestShared';

describe('VsTestPlatformToolInstaller Suite', function() {
    //this.timeout(30000);
    before((done) => {
        done();
        //console.log('before');
    });

    beforeEach((done) => {
        //delete process.env['VsTestToolsInstallerInstalledToolLocation'];
        done();
    });

    after(function () {
        //console.log('after');
    });

    it('Basic test', (done: MochaDone) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        process.env['versionSelector'] = 'latestPreRelease';
        process.env['testPlatformVersion'] = '';

        tr.run();
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(tr.errorIssues);
        assert(tr.stdOutContained('InstallationSuccessful'));
        // assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        // assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        // assert(tr.succeeded, 'task should have succeeded');
        // assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} -t test/test:2`) != -1, "docker build should run");
        // console.log(tr.stderr);
        done();
    });

    // it('Runs successfully for docker build for invalid image name', (done:MochaDone) => {
    //     let tp = path.join(__dirname, 'TestSetup.js');
    //     let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    //     process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
    //     process.env[shared.TestEnvVars.imageName] = 'test/Te st:2';
    //     tr.run();
});
