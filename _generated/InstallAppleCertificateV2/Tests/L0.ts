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

    it('Defaults: install cert in temporary keychain', async () => {
        let tp: string = path.join(__dirname, 'L0InstallTempKeychain.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /build/temp/ios_signing_temp.keychain'),
            'certificate should have been installed in the keychain');
        assert(tr.ran('/usr/bin/security create-keychain -p 115 /build/temp/ios_signing_temp.keychain'),
            'temp keychain should have been created.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Defaults: install cert with empty password in temporary keychain', async () => {
        let tp: string = path.join(__dirname, 'L0InstallCertWithEmptyPassword.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P  -A -t cert -f pkcs12 -k /build/temp/ios_signing_temp.keychain'),
            'certificate should have been installed in the keychain');
        assert(tr.ran('/usr/bin/security create-keychain -p 115 /build/temp/ios_signing_temp.keychain'),
            'temp keychain should have been created.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Defaults: delete temporary keychain after build', async () => {
        let tp: string = path.join(__dirname, 'L0DeleteTempKeychain.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/usr/bin/security delete-keychain /build/temp/ios_signing_temp.keychain'),
            'keychain should have been deleted');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Defaults: install certificate in default keychain before build', async () => {
        let tp: string = path.join(__dirname, 'L0InstallDefaultKeychain.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /usr/lib/login.keychain'),
            'certificate should have been installed in the default keychain');
        assert(!tr.ran('/usr/bin/security create-keychain -p mykeychainPwd /usr/lib/login.keychain'), 'login keychain should not be created')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Defaults: install certificate in default keychain before build with openssl args', async () => {
        let tp: string = path.join(__dirname, 'L0InstallDefaultKeychainWithArgs.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /usr/lib/login.keychain'),
            'certificate should have been installed in the default keychain');
        assert(!tr.ran('/usr/bin/security create-keychain -p mykeychainPwd /usr/lib/login.keychain'), 'login keychain should not be created')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });


    it('Defaults: delete certificate from default keychain after build', async () => {
        let tp: string = path.join(__dirname, 'L0DeleteCertDefaultKeychain.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(!tr.ran('/usr/bin/security delete-keychain /usr/lib/login.keychain'),
            'defualt keychain should not have been deleted');
        assert(tr.ran('/usr/bin/security delete-certificate -Z SHA1HASHOFP12CERTIFICATE /usr/lib/login.keychain'),
            'certificate should have been deleted from the default keychain.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Defaults: with user input CN do not parse for it', async () => {
        // there is no way to verify the variable value as it is a 'side effect'
        // this test just verifies that with user set CN, the task still works
        let tp: string = path.join(__dirname, 'L0UserSupplyCN.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /usr/lib/login.keychain'),
            'certificate should have been installed in the default keychain');
        assert(!tr.ran('/usr/bin/security create-keychain -p mykeychainPwd /usr/lib/login.keychain'), 'login keychain should not be created')
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded')
    });

    it('Installs certificate valid for a brief time', async () => {
        let tp: string = path.join(__dirname, 'L0CertificateValidForABriefTime.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Fails on expired certificate', async () => {
        let tp: string = path.join(__dirname, 'L0FailOnExpiredCertificate.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.errorIssues[0].indexOf('Error: loc_mock_CertExpiredError') >= 0, 'error message should match expected');
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

    it('Defaults: install cert in temporary keychain - skip partition_id ACL', async () => {
        let tp: string = path.join(__dirname, 'L0InstallTempKeychainSkipPartitionIdACL.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /build/temp/ios_signing_temp.keychain'),
            'certificate should have been installed in the keychain');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        assert(tr.stdout.indexOf('Setting the partition_id ACL') < 0, 'Setting the partition_id ACL should be skipped if setUpPartitionIdACLForPrivateKey=true')
    });
});
