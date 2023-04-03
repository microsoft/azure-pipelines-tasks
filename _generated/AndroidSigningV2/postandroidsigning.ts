import fs = require('fs');
import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import secureFilesCommon = require('azure-pipelines-tasks-securefiles-common/securefiles-common');

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
