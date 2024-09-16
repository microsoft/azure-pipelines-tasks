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
        'security': 'path/to/security',
    },
    'exec': {
        'path/to/security find-identity -v -p codesigning ': {
            "code": 0,
            "stdout": null
        }
    }
}

const stdOuts = [
    { keychainPath: 'test1/path1' },
    { keychainPath: 'test2/path2' },
    { keychainPath: 'test3/path3' },
    { keychainPath: 'test4/path4' },
    { keychainPath: 'test5/path5' },
    { keychainPath: 'test6/path6' },
    { keychainPath: 'test7/path7' },
    { keychainPath: 'test8/path8' },
]

export function findSigningIdentityTest() {
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

    it(`Shoud throw error on incorrect path`, (done: MochaDone) => {
        tlClone.setAnswers(tmAnswers);
        mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
        let iosSigning = require("../ios-signing-common");

        iosSigning.findSigningIdentity('').
            then(res => done(res)).
            catch(err => {
                assert.ok(err.includes("SignIdNotFound"));
                done();
            });
    });

    for (let i = 0; i < stdOuts.length; i++) {
        const { keychainPath } = stdOuts[i];
        const key = `path/to/security find-identity -v -p codesigning ${keychainPath}`;
        const stdout = `found ${keychainPath}`
        tmAnswers['exec'][key] = {
            stdout: `"${stdout}"`,
            code: 0
        };

        it(`Shoud return correct value for plist path ${keychainPath}`, (done: MochaDone) => {
            tlClone.setAnswers(tmAnswers);
            mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
            let iosSigning = require("../ios-signing-common");

            iosSigning.findSigningIdentity(keychainPath).
                then(res => {
                    assert.equal(res, stdout);
                    done();
                }).
                catch(err => done(err));

        })
    }
}