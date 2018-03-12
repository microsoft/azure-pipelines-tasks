import path = require('path');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import tl = require('vsts-task-lib/task');

async function run() {
    let secureFileId: string = tl.getInput('secureFile', true);
    let targetFolder: string = tl.getInput('secureFilePath', false);
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // download decrypted contents
        secureFileHelpers = new secureFilesCommon.SecureFileHelpers();
        let secureFilePath: string = await secureFileHelpers.downloadSecureFile(secureFileId, targetFolder);

        if (tl.exist(secureFilePath)) {
            // set the secure file output variable.
            tl.setVariable('secureFilePath', secureFilePath);
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();