import * as path from 'path';
import * as secureFilesCommon from 'securefiles-common/securefiles-common';
import * as tl from 'vsts-task-lib/task';

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    let keystoreFileId: string;
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const apksign: boolean = tl.getBoolInput('apksign');
        if (apksign) {
            // download keystore file
            keystoreFileId = tl.getInput('keystoreFile', true);
            secureFileHelpers = new secureFilesCommon.SecureFileHelpers();
            const keystoreFilePath: string = await secureFileHelpers.downloadSecureFile(keystoreFileId);
            tl.setTaskVariable('KEYSTORE_FILE_PATH', keystoreFilePath);
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();
