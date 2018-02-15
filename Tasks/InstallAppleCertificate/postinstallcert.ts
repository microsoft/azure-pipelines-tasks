import path = require('path');
import tl = require('vsts-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        let keychain: string = tl.getInput('keychain');
        let keychainPath: string = tl.getTaskVariable('APPLE_CERTIFICATE_KEYCHAIN');

        let deleteCert: boolean = tl.getBoolInput('deleteCert');
        let hash: string = tl.getTaskVariable('APPLE_CERTIFICATE_SHA1HASH');
        if (deleteCert && hash) {
            sign.deleteCert(keychainPath, hash);
        }

        let deleteKeychain: boolean = false;
        if (keychain === 'temp') {
            deleteKeychain = true;
        } else if (keychain === 'custom') {
            deleteKeychain = tl.getBoolInput('deleteCustomKeychain');
        }

        if (deleteKeychain && keychainPath) {
            await sign.deleteKeychain(keychainPath);
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();