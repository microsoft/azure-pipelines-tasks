import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'vsts-task-lib/mock-test';

describe('InstallAppleProvisioningProfile Suite', function () {
    this.timeout(20000);
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
});