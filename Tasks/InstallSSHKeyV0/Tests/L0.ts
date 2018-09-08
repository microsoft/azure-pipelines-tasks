import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'vsts-task-lib/mock-test';

describe('InstallSSHKey Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    before(() => {
    });

    after(() => {
    });

    it('Start ssh-agent', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0StartAgent.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('SSH key already installed', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0KeyAlreadyInstalled.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('loc_mock_SSHKeyAlreadyInstalled'), 'expected error: SSH key already installed');

        done();
    });

    it('SSH key malformed', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0KeyMalformed.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('loc_mock_SSHPublicKeyMalformed'), 'expected error: SSH key malformed');

        done();
    });
});