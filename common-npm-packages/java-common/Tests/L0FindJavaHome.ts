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
        'reg': true,
    },
    'which': {
        'reg': 'reg'
    },
    'exec': {

    }
}

const stdOuts = [
    { jdkVersion: '1.2', jdkArch: 'x86', javaHomeExists: true },
    { jdkVersion: '1.2', jdkArch: 'x64', javaHomeExists: true },
    { jdkVersion: '2.1', jdkArch: 'x86', javaHomeExists: true },
    { jdkVersion: '2.1', jdkArch: 'x64', javaHomeExists: true },
    { jdkVersion: '3.1', jdkArch: 'x86', javaHomeExists: true },
    { jdkVersion: '3.1', jdkArch: 'x64', javaHomeExists: true },
    { jdkVersion: '9.1', jdkArch: 'x86', javaHomeExists: true },
    { jdkVersion: '1.1', jdkArch: 'aarch', javaHomeExists: true },
    { jdkVersion: '2.1', jdkArch: 'aarch', javaHomeExists: true },
    { jdkVersion: '9.1', jdkArch: 'aarch', javaHomeExists: true },
    { jdkVersion: '4.1', jdkArch: 'x86', javaHomeExists: false },
    { jdkVersion: '4.1', jdkArch: 'x64', javaHomeExists: false },
    { jdkVersion: '5.1', jdkArch: 'x86', javaHomeExists: false },
    { jdkVersion: '5.1', jdkArch: 'x64', javaHomeExists: false },
    { jdkVersion: '10.4', jdkArch: 'x86', javaHomeExists: false },
    { jdkVersion: '1.6', jdkArch: 'aarch', javaHomeExists: false },
    { jdkVersion: '4.4', jdkArch: 'aarch', javaHomeExists: false },
    { jdkVersion: '10.7', jdkArch: 'aarch', javaHomeExists: false },
];

const foundedPath = "found/jdk/in/env/var"
tlClone.getVariable = variable => {
    let vars = stdOuts.filter(el => {
        const vers = el.jdkVersion.split('.');
        const name = "JAVA_HOME_" + (vers[0] === '1' ? vers[1] : vers[0]) + "_" + el.jdkArch.toUpperCase()
        return el.javaHomeExists && variable === name;
    })

    if (variable === 'JAVA_HOME_11_X86') return `win_${foundedPath}`;
    if (variable === 'JAVA_HOME_11_AARCH') return `unix_${foundedPath}`;
    if (vars.length) return foundedPath;
    return null;
}

const createCommand = (jdkArch, jdkVersion) => {
    return [
        [`reg query HKLM\\SOFTWARE\\JavaSoft\\JDK\\ /f ${jdkVersion} /k`, `HKEY_LOCAL_MACHINE\\JavaSoft\\${jdkVersion}`],
        [`reg query HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit\\ /f 1.${jdkVersion} /k`, `HKEY_LOCAL_MACHINE\\JavaSoft\\${jdkVersion}`],
        [`reg query HKLM\\JavaSoft\\${jdkVersion} /v JavaHome ${jdkArch === 'x86' ? '/reg:32' : '/reg:64'}`, `JavaSoftREG_SZpath/to/${jdkVersion}/${jdkArch}`],
    ]
}

const createHeader = (jdkArch, jdkVersion, javaHomeExists) => {
    let testStr = 'Should ';
    if (javaHomeExists) testStr += `get correct path from ENV var, jdkVersion: ${jdkVersion} jdkArch: ${jdkArch}`;
    else if (jdkArch == 'aarch' && jdkVersion.startsWith('10.')) testStr += `return jdk 11 for linux unsupported JDKs, jdkVersion: ${jdkVersion} jdkArch: ${jdkArch}`;
    else if (jdkArch == 'aarch' && !jdkVersion.startsWith('10.')) testStr += `throw an error for non-win os with non installed jdk, jdkVersion: ${jdkVersion} jdkArch: ${jdkArch}`;
    else testStr += `find path in reg, jdkVersion: ${jdkVersion} jdkArch: ${jdkArch}`;

    return testStr;
}

export function findJavaHomeTest() {
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
        mockery.deregisterMock('os');
    });

    for (let i = 0; i < stdOuts.length; i++) {
        const { jdkVersion, jdkArch, javaHomeExists } = stdOuts[i];
        let testStr = createHeader(jdkArch, jdkVersion, javaHomeExists);

        const commands = createCommand(jdkArch, jdkVersion);
        commands.forEach(el => {
            const [command, output] = el;
            tmAnswers['exec'][command] = {
                stdout: output || null,
                code: 0
            }
        });

        it(testStr, (done: MochaDone) => {
            let taskOutput = '';
            tlClone.setAnswers(tmAnswers);
            tlClone.setStdStream({
                write: (msg) => taskOutput += msg
            });

            mockery.registerMock('azure-pipelines-task-lib/task', tlClone);
            mockery.registerMock('os', Object.assign(require('os'), {
                platform: function () {
                    if (jdkArch === 'aarch') return jdkArch;
                    return 'win32'
                }
            }));

            try {
                const javaCommon = require("../java-common");
                const path = javaCommon.findJavaHome(jdkVersion, jdkArch);

                if (javaHomeExists) {
                    assert.equal(path, foundedPath);
                    done();
                } else if (jdkArch == 'aarch') {
                    assert.equal(path, `unix_${foundedPath}`);
                    assert.ok(taskOutput.indexOf('UnsupportedJdkWarning') >= 0);
                    done();
                } else {
                    assert.ok(taskOutput.indexOf('SearchingRegistryKeys') >= 0);
                    assert.ok(taskOutput.indexOf('RegistryKeysFound') >= 0);
                    assert.ok(taskOutput.indexOf('JAVA_HOME') >= 0);
                    assert.equal(path, `path/to/${jdkVersion}/${jdkArch}`);
                    done();
                }
            } catch (err) {
                if (jdkArch == 'aarch' && !jdkVersion.startsWith('10.')) {
                    assert.ok(err.message.indexOf('FailedToLocateSpecifiedJVM') >= 0)
                    done();
                } else {
                    done(err);
                }
            }
        });
    }
}
