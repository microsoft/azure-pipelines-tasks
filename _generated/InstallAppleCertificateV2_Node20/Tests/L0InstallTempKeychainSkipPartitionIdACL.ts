import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import path = require('path');
import fs = require('fs');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'preinstallcert.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('certSecureFile', 'mySecureFileId');
tr.setInput('certPwd', 'mycertPwd');
tr.setInput('keychain', 'temp');
tr.setInput('setUpPartitionIdACLForPrivateKey', 'true');

let secureFileHelperMock = require('azure-pipelines-tasks-securefiles-common/securefiles-common-mock');
tr.registerMock('azure-pipelines-tasks-securefiles-common/securefiles-common', secureFileHelperMock);

tr.registerMock('fs', {
    ...fs,
    writeFileSync: function (filePath, contents) {
    }
});


// Mock Math.random() to always return the same value for our tests.
Math.random = function (): number {
    return 1337;
}

process.env['AGENT_VERSION'] = '2.116.0';
process.env['AGENT_TEMPDIRECTORY'] = '/build/temp';
process.env['HOME'] = '/users/test';

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "openssl": "/usr/bin/openssl",
        "security": "/usr/bin/security",
        "grep": "/usr/bin/grep"
    },
    "checkPath": {
        "/usr/bin/openssl": true,
        "/usr/bin/security": true,
        "/usr/bin/grep": true
    },
    "exist": {
        "/build/temp/mySecureFileId.filename": true,
        "/build/temp/ios_signing_temp.keychain": true
    },
    "exec": {
        "/usr/bin/openssl pkcs12 -in /build/temp/mySecureFileId.filename -nokeys -passin pass:mycertPwd | /usr/bin/openssl x509 -sha1 -noout -fingerprint -subject -dates -nameopt utf8,sep_semi_plus_space": {
            "code": 0,
            "stdout": "MAC verified OK\nSHA1 Fingerprint=BB:26:83:C6:AA:88:35:DE:36:94:F2:CF:37:0A:D4:60:BB:AE:87:0C\nsubject=UID=ZD34QB2EFN; CN=iPhone Developer: Madhuri Gummalla (HE432Y3E2Q); OU=A9M46DL4GH; O=Madhuri Gummalla; C=US\nnotBefore=Nov 13 03:37:42 2018 GMT\nnotAfter=Nov 13 03:37:42 2099 GMT\n"
        },
        "/usr/bin/openssl pkcs12 -in /build/temp/mySecureFileId.filename -nocerts -passin pass:mycertPwd -passout pass:mycertPwd | /usr/bin/grep friendlyName": {
            "code": 0,
            "stdout": "MAC verified OK\n    friendlyName: iOS Developer: Madhuri Gummalla (Madhuri Gummalla)"
        },
        "/usr/bin/security create-keychain -p 115 /build/temp/ios_signing_temp.keychain": {
            "code": 0,
            "stdout": "keychain created"
        },
        "/usr/bin/security set-keychain-settings -lut 21600 /build/temp/ios_signing_temp.keychain": {
            "code": 0,
            "stdout": "keychain settings"
        },
        "/usr/bin/security unlock-keychain -p 115 /build/temp/ios_signing_temp.keychain": {
            "code": 0,
            "stdout": "keychain unlocked"
        },
        "/usr/bin/security import /build/temp/mySecureFileId.filename -P mycertPwd -A -t cert -f pkcs12 -k /build/temp/ios_signing_temp.keychain": {
            "code": 0,
            "stdout": "cert installed"
        },
        "/usr/bin/security set-key-partition-list -S apple-tool:,apple: -s -l iOS Developer: Madhuri Gummalla (Madhuri Gummalla) -k 115 /build/temp/ios_signing_temp.keychain": {
            "code": 0,
            "stdout": "dumped keychain key"
        },
        "/usr/bin/security list-keychain -d user": {
            "code": 0,
            "stdout": "/user/bin/login.keychain\n/build/temp/ios_signing_temp.keychain"
        }
    }
};
tr.setAnswers(a);

os.platform = () => {
    return 'darwin';
}
tr.registerMock('os', os);

tr.run();

