import * as mocker from "azure-pipelines-task-lib/lib-mocker";
import * as assert from "assert";

import { setToolProxy } from "./utils"

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.tool = setToolProxy(tlClone.tool);

const tmAnswers = {
    'checkPath': {
        'security': true,
        'openssl': true,
        'grep': true
    },
    'which': {
        'security': 'security',
        'openssl': 'openssl',
        'grep': 'grep'
    },
    'exec': {},
    'exist': {}
}

const stdOuts = [
    { keychainPath: 'keychainPath1', keychainPwd: 'keychainPwd1', p12CertPath: 'p12CertPath1', p12Pwd: 'p12Pwd1', useKeychainIfExists: false, skipPartitionIdAclSetup: true },
    { keychainPath: 'keychainPath2', keychainPwd: 'keychainPwd2', p12CertPath: 'p12CertPath2', p12Pwd: 'p12Pwd2', useKeychainIfExists: false, skipPartitionIdAclSetup: true },
    { keychainPath: 'keychainPath3', keychainPwd: 'keychainPwd3', p12CertPath: 'p12CertPath3', p12Pwd: 'p12Pwd3', useKeychainIfExists: true, skipPartitionIdAclSetup: true },
    { keychainPath: 'keychainPath4', keychainPwd: 'keychainPwd4', p12CertPath: 'p12CertPath4', p12Pwd: 'p12Pwd4', useKeychainIfExists: true, skipPartitionIdAclSetup: true },
    { keychainPath: 'keychainPath5', keychainPwd: 'keychainPwd5', p12CertPath: 'p12CertPath5', p12Pwd: 'p12Pwd5', useKeychainIfExists: true, skipPartitionIdAclSetup: false },
    { keychainPath: 'keychainPath6', keychainPwd: 'keychainPwd6', p12CertPath: 'p12CertPath6', p12Pwd: 'p12Pwd6', useKeychainIfExists: true, skipPartitionIdAclSetup: false, opensslPkcsArgs: '-legacy' },
    { keychainPath: 'keychainPath7', keychainPwd: 'keychainPwd7', p12CertPath: 'p12CertPath7', p12Pwd: 'p12Pwd7', useKeychainIfExists: false, skipPartitionIdAclSetup: false },
    { keychainPath: 'keychainPath8', keychainPwd: 'keychainPwd8', p12CertPath: 'p12CertPath8', p12Pwd: 'p12Pwd8', useKeychainIfExists: false, skipPartitionIdAclSetup: false },
];

const createKeychainCommandPaths = (args) => {
    const { keychainPath, keychainPwd, p12CertPath, p12Pwd, useKeychainIfExists, skipPartitionIdAclSetup, opensslPkcsArgs } = args;
    const openSSLargs = useKeychainIfExists && !skipPartitionIdAclSetup && opensslPkcsArgs ? `${opensslPkcsArgs} ` : '';

    return [
        [`${tmAnswers['which']['security']} delete-keychain ${keychainPath}`],
        [`${tmAnswers['which']['security']} create-keychain -p ${keychainPwd} ${keychainPath}`],
        [`${tmAnswers['which']['security']} set-keychain-settings -lut 21600 ${keychainPath}`],
        [`${tmAnswers['which']['security']} unlock-keychain -p ${keychainPwd} ${keychainPath}`],
        [`${tmAnswers['which']['security']} import ${p12CertPath} -P ${p12Pwd} -A -t cert -f pkcs12 -k ${keychainPath}`],
        [`${tmAnswers['which']['security']} set-key-partition-list -S apple-tool:,apple: -s -l ${p12CertPath} -k ${keychainPwd} ${keychainPath}`],
        [`${tmAnswers['which']['security']} list-keychain -d user`, keychainPath],
        [`${tmAnswers['which']['security']} list-keychain -d user -s ${keychainPath}`],
        [`${tmAnswers['which']['openssl']} pkcs12 -in ${p12CertPath} -nocerts -passin pass:${p12Pwd} -passout pass:${p12Pwd} ${openSSLargs}| grep friendlyName`, `friendlyName: ${p12CertPath}`],
    ]
}

export function installCertInTemporaryKeychainTest() {
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
        const { keychainPath, keychainPwd, p12CertPath, p12Pwd, useKeychainIfExists, skipPartitionIdAclSetup, opensslPkcsArgs } = stdOuts[i];
        const paths = createKeychainCommandPaths(stdOuts[i])

        tmAnswers['exist'][keychainPath] = true;
        paths.forEach(arr => {
            const [path, output] = arr;
            if (tmAnswers['exec'][path] && tmAnswers['exec'][path]['stdout']) {
                tmAnswers['exec'][path]['stdout'] = tmAnswers['exec'][path]['stdout'] + `\n ${output}`
            } else {
                tmAnswers['exec'][path] = {
                    stdout: output || null,
                    code: 0
                }
            }
        });


        it(`Shoud install cert correctly keychainPath: ${keychainPath}`, (done: MochaDone) => {
            let taskOutput = '';
            tlClone.setAnswers(tmAnswers);
            tlClone.setStdStream({
                write: (msg) => taskOutput += msg
            });

            mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
            let iosSigning = require("../ios-signing-common");

            iosSigning.installCertInTemporaryKeychain(keychainPath, keychainPwd, p12CertPath, p12Pwd, useKeychainIfExists, skipPartitionIdAclSetup, opensslPkcsArgs).
                then(resp => {
                    if (!useKeychainIfExists) {
                        assert.ok(taskOutput.indexOf('delete-keychain') >= 0);
                        assert.ok(taskOutput.indexOf('create-keychain') >= 0);
                        assert.ok(taskOutput.indexOf('set-keychain-settings') >= 0);
                    }

                    if (useKeychainIfExists && !skipPartitionIdAclSetup) {
                        assert.ok(taskOutput.indexOf('set-key-partition-list') >= 0);
                    }

                    assert.ok(taskOutput.indexOf('"-A","-t","cert","-f","pkcs12","-k"') >= 0);
                    assert.ok(taskOutput.indexOf('["list-keychain","-d","user"]') >= 0);
                    done();
                }).
                catch(err => done(err));
        });
    }


}