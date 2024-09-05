import * as mockery from "mockery";
import * as assert from "assert";

import { setToolProxy } from "./utils"

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.tool = setToolProxy(tlClone.tool);

const tmAnswers = {
    'checkPath': {
        'openssl': true,
        'grep': true
    },
    'which': {
        'openssl': 'openssl',
        'grep': 'grep'
    },
    'exec': {},
    'exist': {}
}

const stdOuts = [
    { p12CertPath: 'some1/path1', p12Pwd: 'somepassword', frendlyName: 'testName1', addOutput: true },
    { p12CertPath: 'some2/path2', p12Pwd: 'somepwd', frendlyName: 'testName2', addOutput: true },
    { p12CertPath: 'some3/path3', p12Pwd: 'somepwds', frendlyName: 'testName3', addOutput: true, opensslPkcsArgs: '-clcerts' },
    { p12CertPath: 'some4/path4', p12Pwd: 'somepass', frendlyName: 'testName4', addOutput: false },
];

const createOpenSSlCommand = (p12CertPath, p12Pwd, frendlyName, addOutput, opensslPkcsArgs) => {
    const args = opensslPkcsArgs ? `${opensslPkcsArgs} ` : ''
    return {
        command: `${tmAnswers['which']['openssl']} pkcs12 -in ${p12CertPath} -nocerts -passin pass:${p12Pwd} -passout pass:${p12Pwd} ${args}| grep friendlyName`,
        output: addOutput && `friendlyName: ${frendlyName}`
    }
}

export function getP12PrivateKeyNameTest() {
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

    for (let i = 0; i < stdOuts.length; i++) {
        const { p12CertPath, p12Pwd, frendlyName, addOutput, opensslPkcsArgs} = stdOuts[i];
        const { command, output } = createOpenSSlCommand(p12CertPath, p12Pwd, frendlyName, addOutput, opensslPkcsArgs);
        tmAnswers['exec'][command] = {
            stdout: output || null,
            code: 0
        }

        it(`Shoud return correct name by path: ${p12CertPath}`, (done: MochaDone) => {
            let taskOutput = '';
            tlClone.setAnswers(tmAnswers);
            tlClone.setStdStream({
                write: (msg) => taskOutput += msg
            });

            mockery.registerMock('azure-pipelines-task-lib/task', tlClone);
            let iosSigning = require("../ios-signing-common");
            const openPksRes = opensslPkcsArgs ? `,"${opensslPkcsArgs || ''}"` : '';
            iosSigning.getP12PrivateKeyName(p12CertPath, p12Pwd, opensslPkcsArgs).
                then(resp => {
                    const resStr = `["pkcs12","-in","${p12CertPath}","-nocerts","-passin","pass:${p12Pwd}","-passout","pass:${p12Pwd}"${openPksRes}]`;
                    assert.ok(taskOutput.indexOf(resStr) >= 0)
                    assert.equal(resp, frendlyName);
                    done();
                }).
                catch(err => {
                    if (!addOutput) {
                        assert.ok(err.message.indexOf('P12PrivateKeyNameNotFound') >= 0);
                        done();
                    } else {
                        done(err)
                    }
                });
        });
    }
}