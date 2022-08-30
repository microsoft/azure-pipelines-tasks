import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import secureFilesCommon = require('azure-pipelines-tasks-securefiles-common/securefiles-common');

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
