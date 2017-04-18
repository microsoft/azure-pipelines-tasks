import path = require('path');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import tl = require('vsts-task-lib/task');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    let secureFileId: string;
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // download decrypted contents
        secureFileId = tl.getInput('sshKeySecureFile', true);
        secureFileHelpers = new secureFilesCommon.SecureFileHelpers();
        let sshKeyPath: string = await secureFileHelpers.downloadSecureFile(secureFileId);

        if (tl.exist(sshKeyPath)) {
        }

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        // delete provisioning profile from temp location after installing
        if (secureFileId && secureFileHelpers) {
            secureFileHelpers.deleteSecureFile(secureFileId);
        }
    }
}

run();