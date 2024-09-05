import * as mockery from "mockery";
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
        'PlistBuddy': true
    },
    'which': {
        'security': 'path/to/security',
        '/usr/libexec/PlistBuddy': 'PlistBuddy'
    },
    'exec': {
        'PlistBuddy -c Print $itemToPrint $plistPath': {
            "code": 0,
            "stdout": "found plistPath"
        }
    }
}

const stdOuts = [
    { plistPath: 'test1/path1' },
    { plistPath: 'test2/path2' },
    { plistPath: 'test3/path3' },
    { plistPath: 'test4/path4' },
    { plistPath: 'test5/path5' },
    { plistPath: 'test6/path6' },
    { plistPath: 'test7/path7' },
    { plistPath: 'test8/path8' },
]

export function getBundleIdFromPlistTest() {
    before(() => {
        mockery.disable();
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        } as mockery.MockeryEnableArgs);
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

    it(`Shoud return null on empty parameters`, (done: MochaDone) => {
        tlClone.setAnswers(tmAnswers);
        mockery.registerMock('azure-pipelines-task-lib/task', tlClone);
        let iosSigning = require("../ios-signing-common");
        
        iosSigning.getBundleIdFromPlist().
            then(res => {
                assert.equal(res, null);
                done()
            }).
            catch(err => done(err));
    });

    for (let i = 0; i < stdOuts.length; i++) {
        const { plistPath } = stdOuts[i];
        const key = `PlistBuddy -c Print CFBundleIdentifier ${plistPath}`;
        const stdout = `found ${plistPath}`
        tmAnswers['exec'][key] = {
            stdout: stdout,
            code: 0
        };

        it(`Shoud return correct value for plist path ${plistPath}`, (done: MochaDone) => {
            tlClone.setAnswers(tmAnswers);
            mockery.registerMock('azure-pipelines-task-lib/task', tlClone);
            let iosSigning = require("../ios-signing-common");

            iosSigning.getBundleIdFromPlist(plistPath).
                then(res => {
                    assert.equal(res, stdout);
                    done();
                }).
                catch(err => done(err));
        });
    }
}