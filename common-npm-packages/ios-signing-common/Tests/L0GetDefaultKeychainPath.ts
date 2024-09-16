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
        'path/to/security default-keychain': {
            "code": 0,
            "stdout": "path/to/default/keychain"
        }
    },
}
const stdOuts = [
    'path/to/default/keychain',
    'path/to/a/b',
    'a/b/c/f',
    'some/temp/path',
    'never/gonna/give/you/up',
    'never/gonna/let/you/down',
    'never/gonna/run/around',
]

export function getDefaultKeychainPathTest() {
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

    for (let i = 0; i < stdOuts.length; i++) {
        it(`check correct formed path to default keychain: ${stdOuts[i]}`, (done: MochaDone) => {
            tmAnswers['exec']['path/to/security default-keychain']['stdout'] = stdOuts[i];
            tlClone.setAnswers(tmAnswers);

            mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
            let iosSigning = require("../ios-signing-common");
          
            iosSigning.getDefaultKeychainPath().
                then(resp => {
                    assert.equal(resp, stdOuts[i]);
                    done();
                }).
                catch(err => done(err));
        });
    }
}