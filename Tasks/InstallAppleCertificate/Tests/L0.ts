import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'vsts-task-lib/mock-test';

describe('InstallAppleCertificate Suite', function () {
    this.timeout(20000);
    before(() => {
    });

    after(() => {
    });

    it('Defaults: install cert in temporary keychain', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0InstallTempKeychain.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /build/temp/ios_signing_temp.keychain'),
            'certificate should have been installed in the keychain');
        assert(tr.ran('/usr/bin/security create-keychain -p mykeychainPwd /build/temp/ios_signing_temp.keychain'),
            'temp keychain should have been created.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Defaults: delete temporary keychain after build', (done: MochaDone) => {
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

    it('Defaults: install certificate in default keychain before build', (done: MochaDone) => {
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

    it('Defaults: delete certificate from default keychain after build', (done: MochaDone) => {
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
});