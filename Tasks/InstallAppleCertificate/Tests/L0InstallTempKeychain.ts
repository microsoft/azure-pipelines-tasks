import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'preinstallcert.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('certSecureFile', 'mySecureFileId');
tr.setInput('certPwd', 'mycertPwd');
tr.setInput('keychain', 'temp');
tr.setInput('keychainPassword', 'mykeychainPwd');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['AGENT_TEMPDIRECTORY'] = '/build/temp';
process.env['HOME'] = '/users/test';

let secureFileHelperMock = require('securefiles-common/securefiles-common-mock');
tr.registerMock('securefiles-common/securefiles-common', secureFileHelperMock);

tr.registerMock('fs', {
    existsSync: function (filePath) {
        if (filePath === '/build/temp/ios_signing_temp.keychain') {
            return false;
        }
    },
    writeFileSync: function (filePath, contents) {
    }
});

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "openssl": "/usr/bin/openssl",
        "security": "/usr/bin/security"
    },
    "checkPath": {
        "/usr/bin/openssl": true,
        "/usr/bin/security": true
    },
    "exist": {
        "/build/temp/mySecureFileId.filename": true,
        "/build/temp/ios_signing_temp.keychain": false
    },
    "exec": {
        "/usr/bin/openssl pkcs12 -in /build/temp/mySecureFileId.filename -nokeys -passin pass:mycertPwd | /usr/bin/openssl x509 -noout -subject": {
            "code": 0,
            "stdout": "MAC verified OK\nsubject= /UID=ZD34QB2EFN/CN=iPhone Developer: Madhuri Gummalla (HE432Y3E2Q)/OU=A9M46DL4GH/O=Madhuri Gummalla/C=US"
        },
        "/usr/bin/openssl pkcs12 -in /build/temp/mySecureFileId.filename -nokeys -passin pass:mycertPwd | /usr/bin/openssl x509 -noout -fingerprint": {
            "code": 0,
            "stdout": "MAC verified OK\nSHA1 Fingerprint=BB:26:83:C6:AA:88:35:DE:36:94:F2:CF:37:0A:D4:60:BB:AE:87:0C"
        },
        "/usr/bin/security create-keychain -p mykeychainPwd /build/temp/ios_signing_temp.keychain": {
            "code": 0,
            "stdout": "keychain created"
        },
        "/usr/bin/security set-keychain-settings -lut 7200 /build/temp/ios_signing_temp.keychain": {
            "code": 0,
            "stdout": "keychain settings"
        },
        "/usr/bin/security unlock-keychain -p mykeychainPwd /build/temp/ios_signing_temp.keychain": {
            "code": 0,
            "stdout": "keychain unlocked"
        },
        "/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /build/temp/ios_signing_temp.keychain": {
            "code": 0,
            "stdout": "cert installed"
        },
        "/usr/bin/security list-keychain -d user": {
            "code": 0,
            "stdout": "/user/bin/login.keychain\n/build/temp/ios_signing_temp.keychain"
        }
    }
};
tr.setAnswers(a);

tr.run();

