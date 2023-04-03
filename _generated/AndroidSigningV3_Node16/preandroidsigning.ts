import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as secureFilesCommon from 'azure-pipelines-tasks-securefiles-common/securefiles-common';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const apksign: boolean = tl.getBoolInput('apksign');
        if (apksign) {
            // download keystore file
            const keystoreFileId: string = tl.getInput('keystoreFile', true);
            const secureFileHelpers: secureFilesCommon.SecureFileHelpers = new secureFilesCommon.SecureFileHelpers();
            const keystoreFilePath: string = await secureFileHelpers.downloadSecureFile(keystoreFileId);
            tl.setTaskVariable('KEYSTORE_FILE_PATH', keystoreFilePath);
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();
