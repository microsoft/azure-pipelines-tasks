import * as mocker from "azure-pipelines-task-lib/lib-mocker";
import * as assert from "assert";

import { setToolProxy } from "./utils"

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.tool = setToolProxy(tlClone.tool);
tlClone.setStdStream({
    write: (msg) => null
});

const tmAnswers = {
    'checkPath': {
        'path/to/security': true,
    },
    'which': {
        'security': 'path/to/security'
    },
    'exec': {

    }
}

const stdOuts = [
    { keychainPath: 'Been', certSha1Hash: 'spendin' },
    { keychainPath: 'most', certSha1Hash: 'their' },
    { keychainPath: 'lives', certSha1Hash: 'livin' },
    { keychainPath: 'inthe', certSha1Hash: 'gangsta' },
    { keychainPath: 'paradise', certSha1Hash: 'keep' },
    { keychainPath: 'spendin', certSha1Hash: 'most' },
    { keychainPath: 'our', certSha1Hash: 'lives' },
    { keychainPath: 'livin', certSha1Hash: 'inthe' },
    { keychainPath: 'gangsta', certSha1Hash: 'paradise' },
    { keychainPath: '', certSha1Hash: '' },
];

export function deleteCertTest() {
    before(() => {
        mocker.disable();
        mocker.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });

    after(() => {
        mocker.deregisterAll();
        mocker.disable();
    });

    beforeEach(() => {
        mocker.resetCache();
    });

    afterEach(() => {
        mocker.deregisterMock('azure-pipelines-task-lib/task');
    });

    it(`Shoud throw error if path not exists`, (done: MochaDone) => {
        mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
        let iosSigning = require("../ios-signing-common");
        
        iosSigning.deleteCert().
            then(res => done(res)).
            catch(err => {
                assert.ok(err instanceof Error);
                done();
            })
    });

    for (let i = 0; i < stdOuts.length; i++) {
        const { keychainPath, certSha1Hash } = stdOuts[i];
        const key = `${tmAnswers['which']['security']} delete-certificate -Z ${certSha1Hash} ${keychainPath}`;
        tmAnswers['exec'][key] = {
            stdout: 'passed',
            code: 0
        };

        it(`check args passed correctly to delete-certificate security command keychainPath:${keychainPath} certSha1Hash:${certSha1Hash}`, (done: MochaDone) => {
            let taskOutput = '';
            tlClone.setAnswers(tmAnswers);
            tlClone.setStdStream({
                write: (msg) => taskOutput += msg
            });

            mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
            let iosSigning = require("../ios-signing-common");

            iosSigning.deleteCert(keychainPath, certSha1Hash).
                then(resp => {
                    assert.ok(taskOutput.indexOf(tmAnswers['which']['security']) >= 0);
                    assert.ok(taskOutput.indexOf(keychainPath) >= 0);
                    assert.ok(taskOutput.indexOf(certSha1Hash) >= 0);
                    done();
                }).
                catch(err => done(err));
        });
    }
}