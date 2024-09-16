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

    },
    'exist': {

    }
}

const stdOuts = [
    'some/path/to/temp',
    'som/e/pat/h/to/temp',
    's/ome/pa/th/to/temp',
    'сan/you/hear/the/silence',
    'some/secondpath/to/temp',
    'so/me/second/path/to/temp',
    's/ome/sec/ondp/ath/to/temp',
    'сan/you/see/the/dark',
    'secondpathto/temp',
    'se/condpa/thto/temp',
    'secon/dpa/thto/temp',
    'сan/you/fix/the/broken',
];


export function deleteKeychainTest() {
    before(() => {
        mocker.disable();
        mocker.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });

    after(() => {
        mocker.disable();
    });

    beforeEach(() => {
        mocker.resetCache();
    });

    afterEach(() => {
        mocker.deregisterAll();
    });


    it(`Shoud not call security when path not exists`, (done: MochaDone) => {
        mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
        let iosSigning = require("../ios-signing-common");

        iosSigning.deleteKeychain().
            then(resp => {
                assert.ok(true);
                done();
            }).
            catch(err => done(err));
    });

    for (let i = 0; i < stdOuts.length; i++) {
        const key = `${tmAnswers['which']['security']} delete-keychain ${stdOuts[i]}`;
        tmAnswers['exec'][key] = {
            stdout: 'passed',
            code: 0
        };
        tmAnswers['exist'][stdOuts[i]] = true;

        it(`check args passed correctly to delete security command ${stdOuts[i]}`, (done: MochaDone) => {
            let taskOutput = '';
            tlClone.setAnswers(tmAnswers);
            tlClone.setStdStream({
                write: (msg) => taskOutput += msg
            });

            mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
            let iosSigning = require("../ios-signing-common");

            iosSigning.deleteKeychain(stdOuts[i]).
                then(resp => {
                    assert.ok(taskOutput.indexOf(tmAnswers['which']['security']) >= 0);
                    assert.ok(taskOutput.indexOf(stdOuts[i]) >= 0);
                    done();
                }).
                catch(err => done(err));
        });
    }
}