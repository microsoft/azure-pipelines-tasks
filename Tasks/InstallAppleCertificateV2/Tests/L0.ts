import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('InstallAppleCertificate Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    before(() => {
    });

    after(() => {
    });

    it('Defaults: install cert in temporary keychain', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0InstallTempKeychain.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /build/temp/ios_signing_temp.keychain'),
            'certificate should have been installed in the keychain');
        assert(tr.ran('/usr/bin/security create-keychain -p 115 /build/temp/ios_signing_temp.keychain'),
            'temp keychain should have been created.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Defaults: install cert with empty password in temporary keychain', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0InstallCertWithEmptyPassword.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P  -A -t cert -f pkcs12 -k /build/temp/ios_signing_temp.keychain'),
            'certificate should have been installed in the keychain');
        assert(tr.ran('/usr/bin/security create-keychain -p 115 /build/temp/ios_signing_temp.keychain'),
            'temp keychain should have been created.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Defaults: delete temporary keychain after build', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0DeleteTempKeychain.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/bin/security delete-keychain /build/temp/ios_signing_temp.keychain'),
            'keychain should have been deleted');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Defaults: install certificate in default keychain before build', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0InstallDefaultKeychain.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /usr/lib/login.keychain'),
            'certificate should have been installed in the default keychain');
        assert(!tr.ran('/usr/bin/security create-keychain -p mykeychainPwd /usr/lib/login.keychain'), 'login keychain should not be created')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Defaults: delete certificate from default keychain after build', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0DeleteCertDefaultKeychain.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(!tr.ran('/usr/bin/security delete-keychain /usr/lib/login.keychain'),
            'defualt keychain should not have been deleted');
        assert(tr.ran('/usr/bin/security delete-certificate -Z SHA1HASHOFP12CERTIFICATE /usr/lib/login.keychain'),
            'certificate should have been deleted from the default keychain.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Defaults: with user input CN do not parse for it', (done: Mocha.Done) => {
        // there is no way to verify the variable value as it is a 'side effect'
        // this test just verifies that with user set CN, the task still works
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0UserSupplyCN.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /usr/lib/login.keychain'),
            'certificate should have been installed in the default keychain');
        assert(!tr.ran('/usr/bin/security create-keychain -p mykeychainPwd /usr/lib/login.keychain'), 'login keychain should not be created')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Installs certificate valid for a brief time', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0CertificateValidForABriefTime.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Fails on expired certificate', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0FailOnExpiredCertificate.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.errorIssues[0].indexOf('Error: loc_mock_CertExpiredError') >= 0, 'error message should match expected');

        done();
    });

    it('Fails on windows', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0FailOnWindows.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.errorIssues[0].indexOf('Error: loc_mock_InstallRequiresMac') >= 0, 'error message should match expected');

        done();
    });

    it('postexecution should not fail for errors', function (done: Mocha.Done) {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0ErrorsInPostExecutionJob.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, 'postexecutionjob should have succeeded with warnings even when there are errors.');
        assert(tr.stdout.indexOf('InstallRequiresMac'), 'warning for macos requirement should be shown.');

        done();
    });

    it('Defaults: install cert in temporary keychain - skip partition_id ACL', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0InstallTempKeychainSkipPartitionIdACL.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /build/temp/ios_signing_temp.keychain'),
            'certificate should have been installed in the keychain');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        assert(tr.stdout.indexOf('Setting the partition_id ACL') < 0, 'Setting the partition_id ACL should be skipped if setUpPartitionIdACLForPrivateKey=true');
        done();
    });
});
