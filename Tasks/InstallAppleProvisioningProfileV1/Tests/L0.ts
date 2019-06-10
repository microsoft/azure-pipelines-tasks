import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('InstallAppleProvisioningProfile Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    before(() => {
    });

    after(() => {
    });

    it('Defaults: install from SecureFile', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0SecureFile.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/bin/security cms -D -i /build/temp/mySecureFileId.filename'),
            'provisioning profile should have been installed.')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Install from source repository', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0SourceRepository.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/bin/security cms -D -i /build/source/myprovisioningprofile.mobileprovision'),
            'provisioning profile should have been installed.')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Install from source repository fails if provisioning profile is not found', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0SourceRepositoryProfileNotFound.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        let expectedErr: string = "loc_mock_InputProvisioningProfileNotFound /build/source/doesnotexist.provisionprofile";
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'Error message should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('Install profile file with no file extension', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0ProfileNoExtension.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/bin/security cms -D -i /build/source/myprovisioningprofile'),
            'provisioning profile should have been installed.');
        assert(tr.ran('/bin/cp -f /build/source/myprovisioningprofile /users/test/Library/MobileDevice/Provisioning Profiles/testuuid'), 
            'copied provisioning profile should not have an extension');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Remove profile during post execution', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0RemoveProfile.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/bin/rm -f /users/test/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision'),
            'provisioning profile should have been deleted.')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Fails on windows', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0FailOnWindows.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.errorIssues[0].indexOf('Error: loc_mock_InstallRequiresMac') >= 0, 'error message should match expected');

        done();
    });

    it('postexecution should not fail for errors', function (done: MochaDone) {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0ErrorsInPostExecutionJob.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, 'postexecutionjob should have succeeded with warnings even when there are errors.');
        assert(tr.stdout.indexOf('InstallRequiresMac'), 'warning for macos requirement should be shown.');
        
        done();
    });
});