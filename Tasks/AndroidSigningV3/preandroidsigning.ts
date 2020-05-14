import * as path from 'path';
import * as secureFilesCommon from 'securefiles-common/securefiles-common';
import * as tl from 'azure-pipelines-task-lib/task';

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
