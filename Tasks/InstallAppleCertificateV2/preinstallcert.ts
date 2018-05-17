import path = require('path');
import sign = require('ios-signing-common/ios-signing-common');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import tl = require('vsts-task-lib/task');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    let secureFileId: string;
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // download decrypted contents
        secureFileId = tl.getInput('certSecureFile', true);
        secureFileHelpers = new secureFilesCommon.SecureFileHelpers();
        let certPath: string = await secureFileHelpers.downloadSecureFile(secureFileId);

        let certPwd: string = tl.getInput('certPwd');

        // get the P12 details - SHA1 hash and common name (CN)
        let p12Hash: string = await sign.getP12SHA1Hash(certPath, certPwd);
        // give user an option to override the CN as a workaround if we can't parse the certificate's subject.
        let p12CN: string = tl.getInput('certSigningIdentity', false);
        if (!p12CN) {
            p12CN = await sign.getP12CommonName(certPath, certPwd);
        }

        if (!p12Hash || !p12CN) {
            throw tl.loc('INVALID_P12');
        }
        tl.setTaskVariable('APPLE_CERTIFICATE_SHA1HASH', p12Hash);

        // set the signing identity output variable.
        tl.setVariable('signingIdentity', p12CN);

        // install the certificate in specified keychain, keychain is created if required
        let keychain: string = tl.getInput('keychain');
        let keychainPwd: string = tl.getInput('keychainPassword');
        let keychainPath: string;
        if (keychain === 'temp') {
            keychainPath = sign.getTempKeychainPath();
            // generate a keychain password for the temporary keychain
            // overriding any value we may have read because keychainPassword is hidden in the designer for 'temp'.
            keychainPwd = Math.random().toString(36);
        } else if (keychain === 'default') {
            keychainPath = await sign.getDefaultKeychainPath();
        } else if (keychain === 'custom') {
            keychainPath = tl.getInput('customKeychainPath', true);
        }
        tl.setTaskVariable('APPLE_CERTIFICATE_KEYCHAIN', keychainPath);

        await sign.installCertInTemporaryKeychain(keychainPath, keychainPwd, certPath, certPwd, true);

        // set the keychain output variable.
        tl.setVariable('keychainPath', keychainPath);

        // Set the legacy variables that doesn't use the task's refName, unlike our output variables.
        // If there are multiple InstallAppleCertificate tasks, the last one wins.
        tl.setVariable('APPLE_CERTIFICATE_SIGNING_IDENTITY', p12CN);
        tl.setVariable('APPLE_CERTIFICATE_KEYCHAIN', keychainPath);
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        // delete certificate from temp location after installing
        if (secureFileId && secureFileHelpers) {
            secureFileHelpers.deleteSecureFile(secureFileId);
        }
    }
}

run();
