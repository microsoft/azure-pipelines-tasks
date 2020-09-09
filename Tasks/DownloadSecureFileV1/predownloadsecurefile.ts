import path = require('path');
import secureFilesCommon = require('azure-pipelines-tasks-securefiles-common/securefiles-common');
import tl = require('azure-pipelines-task-lib/task');

async function run() {
    let secureFileId: string;
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        let retryCount = parseInt(tl.getInput('retryCount'));
        if (isNaN(retryCount) || retryCount < 0) {
            retryCount = 5;
        }
        // download decrypted contents
        secureFileId = tl.getInput('secureFile', true);
        secureFileHelpers = new secureFilesCommon.SecureFileHelpers(retryCount);
        let secureFilePath: string = await secureFileHelpers.downloadSecureFile(secureFileId);

        if (tl.exist(secureFilePath)) {
            // set the secure file output variable.
            tl.setVariable('secureFilePath', secureFilePath);
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();