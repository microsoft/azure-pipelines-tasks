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

    it('Defaults: install from SecureFile', async () => {
        let tp: string = path.join(__dirname, 'L0SecureFile.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/usr/bin/security cms -D -i /build/temp/mySecureFileId.mobileprovision'),
            'provisioning profile should have been installed.')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Install from source repository', async () => {
        let tp: string = path.join(__dirname, 'L0SourceRepository.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/usr/bin/security cms -D -i /build/source/myprovisioningprofile.mobileprovision'),
            'provisioning profile should have been installed.')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Install from source repository fails if provisioning profile is not found', async () => {
        let tp: string = path.join(__dirname, 'L0SourceRepositoryProfileNotFound.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        let expectedErr: string = "loc_mock_InputProvisioningProfileNotFound /build/source/doesnotexist.provisionprofile";
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'Error message should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');
    });

    it('Install profile file with no file extension', async () => {
        let tp: string = path.join(__dirname, 'L0ProfileNoExtension.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/usr/bin/security cms -D -i /build/source/myprovisioningprofile'),
            'provisioning profile should have been installed.');
        assert(tr.ran('/bin/cp -f /build/source/myprovisioningprofile /users/test/Library/MobileDevice/Provisioning Profiles/testuuid'),
            'copied provisioning profile should not have an extension');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Remove profile during post execution', async () => {
        let tp: string = path.join(__dirname, 'L0RemoveProfile.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/bin/rm -f /users/test/Library/MobileDevice/Provisioning Profiles/testuuid.mobileprovision'),
            'provisioning profile should have been deleted.')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Fails on windows', async () => {
        let tp: string = path.join(__dirname, 'L0FailOnWindows.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.errorIssues[0].indexOf('Error: loc_mock_InstallRequiresMac') >= 0, 'error message should match expected');
    });

    it('postexecution should not fail for errors', async function () {
        let tp: string = path.join(__dirname, 'L0ErrorsInPostExecutionJob.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.succeeded, 'postexecutionjob should have succeeded with warnings even when there are errors.');
        assert(tr.stdout.indexOf('InstallRequiresMac'), 'warning for macos requirement should be shown.');

    });
});