import path = require('path');
import * as tl from 'azure-pipelines-task-lib/task';
import sign = require('azure-pipelines-tasks-ios-signing-common/ios-signing-common');
import os = require('os');

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Check platform is macOS since demands are not evaluated on Hosted pools
        if (os.platform() !== 'darwin') {
            console.log(tl.loc('InstallRequiresMac'));
        } else {
            let keychain: string = tl.getInput('keychain');
            let keychainPath: string = tl.getTaskVariable('APPLE_CERTIFICATE_KEYCHAIN');

            let deleteCert: boolean = tl.getBoolInput('deleteCert');
            let hash: string = tl.getTaskVariable('APPLE_CERTIFICATE_SHA1HASH');
            if (deleteCert && hash) {
                await sign.deleteCert(keychainPath, hash);
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
        }
    } catch (err) {
        tl.warning(err);
    }
}

run();