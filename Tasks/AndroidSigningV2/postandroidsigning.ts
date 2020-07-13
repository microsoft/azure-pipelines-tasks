import fs = require('fs');
import path = require('path');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import tl = require('azure-pipelines-task-lib/task');

async function run() {
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));
        let keystoreFile: string = tl.getTaskVariable('KEYSTORE_FILE_PATH');
        if (keystoreFile && tl.exist(keystoreFile)) {
            fs.unlinkSync(keystoreFile);
            tl.debug('Deleted keystore file downloaded from the server: ' + keystoreFile);
        }
    } catch (err) {
        tl.warning(tl.loc('DeleteKeystoreFileFailed', err));
    }
}

run();
