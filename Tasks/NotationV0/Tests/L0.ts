import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as fs from 'fs';
import * as path from 'path';
import assert = require('assert');
import { runCredentialFileTests } from './L0CredentialFile';

describe('NotationV0 Suite', function () {
    runCredentialFileTests();

    it('install notation', async function () {
        this.timeout(10000);

        let tp = path.join(__dirname, 'L0Install.js');
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync()

        assert(tr.succeeded, 'should have succeeded');
    })

    it('notation sign', async function () {
        this.timeout(10000);

        let tp = path.join(__dirname, 'L0Sign.js');
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync()

        assert(tr.succeeded, 'should have succeeded');
    })

    const credentialCases = [
        { auth: 'spnCertificate', signFails: false },
        { auth: 'spnCertificate', signFails: true },
        { auth: 'workloadidentityfederation', signFails: false },
        { auth: 'workloadidentityfederation', signFails: true },
    ];
    for (const credentialCase of credentialCases) {
        const outcome = credentialCase.signFails ? 'failed' : 'successful';
        it(`notation sign removes the ${credentialCase.auth} credential file after a ${outcome} sign`, async function () {
            this.timeout(10000);

            const agentTemp = fs.mkdtempSync(path.join(__dirname, '.agent-temp-'));
            process.env['NOTATION_L0_AUTH'] = credentialCase.auth;
            process.env['NOTATION_L0_TEMP'] = agentTemp;
            process.env['NOTATION_L0_SIGN_FAILS'] = String(credentialCase.signFails);
            try {
                let tp = path.join(__dirname, 'L0SignCredentialCleanup.js');
                let tr = new ttm.MockTestRunner(tp);
                await tr.runAsync()

                assert(tr.stdout.indexOf('CREDENTIAL_FILE_VALID') >= 0, `credential file should be valid while signing:\n${tr.stdout}`);
                // .taskkey is the task library's own vault key, not a credential artifact.
                const leftovers = fs.readdirSync(agentTemp).filter(name => name !== '.taskkey');
                assert.deepStrictEqual(leftovers, [], 'no credential artifact should remain in Agent.TempDirectory');
                if (credentialCase.auth === 'workloadidentityfederation') {
                    assert(tr.stdout.indexOf('##vso[task.setsecret]synthetic-oidc-token') >= 0, 'OIDC token should be registered as a secret');
                }
                if (credentialCase.signFails) {
                    assert(tr.failed, 'should have failed');
                } else {
                    assert(tr.succeeded, 'should have succeeded');
                }
            } finally {
                delete process.env['NOTATION_L0_AUTH'];
                delete process.env['NOTATION_L0_TEMP'];
                delete process.env['NOTATION_L0_SIGN_FAILS'];
                fs.rmSync(agentTemp, { recursive: true, force: true });
            }
        })
    }

    it('notation verify', async function () {
        this.timeout(10000);

        let tp = path.join(__dirname, 'L0Verify.js');
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync()

        assert(tr.succeeded, 'should have succeeded');
    })
})