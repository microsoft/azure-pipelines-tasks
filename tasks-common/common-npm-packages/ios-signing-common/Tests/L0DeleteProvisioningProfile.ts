import * as mocker from "azure-pipelines-task-lib/lib-mocker";
import * as assert from "assert";

import { setToolProxy } from "./utils"

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.tool = setToolProxy(tlClone.tool);

const tmAnswers = {
    'checkPath': {
        'path/to/rm': true,
    },
    'which': {
        'rm': 'path/to/rm',
    },
    'exec': {
        'path/to/rm -f path': {
            "code": 1,
            "stdout": null
        }
    },
    'findMatch': {},
    'exist': {}
}

const stdOuts = {
    "abea0568-7574-11ed-a1eb-0242ac120002": [
        "path/to/file1",
        "path/to/file2",
    ],
    "abea087e-7574-11ed-a1eb-0242ac120002": [
        "path/to/file3"
    ],
    "abea09dc-7574-11ed-a1eb-0242ac120002": [
        "path/to/file4",
        "path/to/file5",
        "path/to/file6",
        "path/to/file7"
    ]
};

export async function deleteProvisioningProfileTest() {
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

    for (let uuid in stdOuts) {
        tmAnswers['findMatch'][`${uuid}*`] = stdOuts[uuid];
        stdOuts[uuid].forEach(basePath => {
            const path = `path/to/rm -f ${basePath}`;
            tmAnswers['exist'][basePath] = true;
            tmAnswers['exec'][path] = {
                "code": 0,
                "stdout": null
            }
        });

        it(`Shoud remove correct Profile based on uuid: ${uuid}`, (done: MochaDone) => {
            let taskOutput = '';
            tlClone.setAnswers(tmAnswers);
            tlClone.setStdStream({
                write: (msg) => taskOutput += msg
            });

            mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
            let iosSigning = require("../ios-signing-common");

            iosSigning.deleteProvisioningProfile(uuid).
                then(res => {
                    assert.ok(taskOutput.indexOf(uuid) >= 0);
                    stdOuts[uuid].forEach(basePath => {
                        assert.ok(taskOutput.indexOf(basePath) >= 0);
                    });
                    done();
                }).
                catch(err => done(err));
        });
    }
}