import * as mocker from "azure-pipelines-task-lib/lib-mocker";
import * as assert from "assert";

import { setToolProxy } from "./utils"

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.tool = setToolProxy(tlClone.tool);

const tmAnswers = {
    'checkPath': {
        'security': true,
        'plistbuddy': true,
        'rm': true
    },
    'which': {
        'security': 'security',
        '/usr/libexec/PlistBuddy': 'plistbuddy',
        'rm': 'rm'
    },
    'exec': {
        'plistbuddy -c Print Entitlements:com.apple.developer.icloud-container-environment _xcodetasktmp.plist': {
            stdout: 'true',
            code: 0
        },
        'rm -f _xcodetasktmp.plist': {
            stdout: '',
            code: 0
        }
    },
    'exist': {}
}

const stdOuts = [
    { provisioningProfilePath: 'some1/path1', exportMethod: 'app-store', result: 'Production' },
    { provisioningProfilePath: 'some2/path2', exportMethod: 'enterprise', result: 'Production' },
    { provisioningProfilePath: 'some3/path3', exportMethod: 'developer-id', result: 'Production' },
    { provisioningProfilePath: 'some4/path4', exportMethod: 'otehr', result: 'Development' },
    { provisioningProfilePath: 'some5/path5', exportMethod: 'otto', result: 'Development' }
];

const createCommand = (provisioningProfilePath) => {
    return {
        command: `${tmAnswers['which']['security']} cms -D -i ${provisioningProfilePath}`,
        output: provisioningProfilePath
    }
}

export function getCloudEntitlementTest() {
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

    for (let i = 0; i < stdOuts.length; i++) {
        const { provisioningProfilePath, exportMethod, result } = stdOuts[i];
        const { command, output } = createCommand(provisioningProfilePath);
        tmAnswers['exec'][command] = {
            stdout: output || null,
            code: 0
        }

        it(`Shoud return correct cloud entitlement for path: ${provisioningProfilePath}`, (done: MochaDone) => {
            let taskOutput = '';
            tlClone.setAnswers(tmAnswers);
            tlClone.setStdStream({
                write: (msg) => taskOutput += msg
            });

            mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
            let iosSigning = require("../ios-signing-common");

            iosSigning.getCloudEntitlement(provisioningProfilePath, exportMethod).
                then(resp => {
                    assert.equal(resp, result);
                    assert.ok(taskOutput.indexOf(provisioningProfilePath) >= 0);
                    assert.ok(taskOutput.indexOf('["-f","_xcodetasktmp.plist"') >= 0);
                    done();
                }).
                catch(err => done(err));
        });
    }

}