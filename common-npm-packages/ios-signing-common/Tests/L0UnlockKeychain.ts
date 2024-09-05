import * as mockery from "mockery";
import * as assert from "assert";

import { setToolProxy } from "./utils"

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign(tl, {});
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
        'path/to/security default-keychain': {
            "code": 0,
            "stdout": "path/to/default/keychain"
        }
    },
}

const stdOuts = [
    { keychainPath: 'Been', keychainPwd: 'spendin' },
    { keychainPath: 'most', keychainPwd: 'their' },
    { keychainPath: 'lives', keychainPwd: 'livin' },
    { keychainPath: 'inthe', keychainPwd: 'gangsta' },
    { keychainPath: 'paradise', keychainPwd: 'keep' },
    { keychainPath: 'spendin', keychainPwd: 'most' },
    { keychainPath: 'our', keychainPwd: 'lives' },
    { keychainPath: 'livin', keychainPwd: 'inthe' },
    { keychainPath: 'gangsta', keychainPwd: 'paradise' },
    { keychainPath: '', keychainPwd: '' },
]

export function unlockKeychainTest() {
    before(() => {
        mockery.disable();
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });

    after(() => {
        mockery.disable();

    });

    beforeEach(() => {
        mockery.resetCache();
    });

    afterEach(() => {
        mockery.deregisterAll();
    });

    it(`Shoud throw error if path not exists`, (done: MochaDone) => {
        mockery.registerMock('azure-pipelines-task-lib/task', tlClone);
        let iosSigning = require("../ios-signing-common");
        
        iosSigning.unlockKeychain().
            then(res => done(res)).
            catch(err => {
                assert.ok(err instanceof Error);
                done();
            });
    });

    for (let i = 0; i < stdOuts.length; i++) {
        const { keychainPath, keychainPwd } = stdOuts[i];
        const key = `${tmAnswers['which']['security']} unlock-keychain -p ${keychainPwd} ${keychainPath}`;
        tmAnswers['exec'][key] = {
            code: 0
        };

        it(`check args passed correctly to security command keychainPath:${keychainPath} keychainPwd:${keychainPwd}`, (done: MochaDone) => {
            let taskOutput = '';
            tlClone.setAnswers(tmAnswers);
            tlClone.setStdStream({
                write: (msg) => taskOutput += msg
            });

            mockery.registerMock('azure-pipelines-task-lib/task', tlClone);
            let iosSigning = require("../ios-signing-common");

            iosSigning.unlockKeychain(keychainPath, keychainPwd).
                then(resp => {
                    assert.ok(taskOutput.indexOf(tmAnswers['which']['security']) >= 0);
                    assert.ok(taskOutput.indexOf(keychainPath) >= 0);
                    assert.ok(taskOutput.indexOf(keychainPwd) >= 0);
                    done();
                }).
                catch(err => done(err));
        });
    }

}