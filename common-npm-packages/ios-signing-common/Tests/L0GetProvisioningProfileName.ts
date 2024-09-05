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
        'security': true,
        '/usr/libexec/PlistBuddy': true,
        'plistbuddy': true,
        'rm': true
    },
    'which': {
        'security': 'security',
        '/usr/libexec/PlistBuddy': 'plistbuddy',
        'rm': 'rm'
    },
    'exec': {
        'plistbuddy -c Print Name _xcodetasktmp.plist': {
            stdout: 'some test name',
            code: 0
        },
        'security cms -D -i some/test/path': {
            stdout: 'testoutput',
            code: 0
        },
        'rm -f _xcodetasktmp.plist': {
            stdout: '',
            code: 0
        }
    },
    'exist': {}
}

export function getProvisioningProfileNameTest() {
    before(() => {
        mockery.disable();
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        } as mockery.MockeryEnableArgs);
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    beforeEach(() => {
        mockery.resetCache();
    });

    afterEach(() => {
        mockery.deregisterMock('azure-pipelines-task-lib/task');
    });

    it(`Shoud return correct Provisioning Profile Name`, (done: MochaDone) => {
        let taskOutput = '';
        tlClone.setAnswers(tmAnswers);
        tlClone.setStdStream({
            write: (msg) => taskOutput += msg
        });

        mockery.registerMock('azure-pipelines-task-lib/task', tlClone);
        let iosSigning = require("../ios-signing-common");

        iosSigning.getProvisioningProfileName('some/test/path').
            then(resp => {
                assert.equal(resp, 'some test name');
                assert.ok(taskOutput.indexOf('some/test/path') >= 0);
                assert.ok(taskOutput.indexOf('["-f","_xcodetasktmp.plist"') >= 0);
                done();
            }).
            catch(err => done(err));
    });
}