import path = require('path');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import tl = require('azure-pipelines-task-lib/task');

async function run() {
    let keystoreFileId: string;
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        let jarsign: boolean = tl.getBoolInput('jarsign');
        if (jarsign) {
            // download keystore file
            keystoreFileId = tl.getInput('keystoreFile', true);
            secureFileHelpers = new secureFilesCommon.SecureFileHelpers();
            let keystoreFilePath: string = await secureFileHelpers.downloadSecureFile(keystoreFileId);
            tl.setTaskVariable('KEYSTORE_FILE_PATH', keystoreFilePath);
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();
