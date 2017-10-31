import path = require('path');
import sign = require('ios-signing-common/ios-signing-common');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import tl = require('vsts-task-lib/task');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    let secureFileId: string;
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        if (tl.getInput('provisioningProfileLocation') === 'sourceRepository') {
            let provProfilePath: string = tl.getInput('provProfileSourceRepository', true);

            if (tl.filePathSupplied('provProfileSourceRepository') && tl.exist(provProfilePath)) {
                let UUID: string = await sign.getProvisioningProfileUUID(provProfilePath);
                tl.setTaskVariable('APPLE_PROV_PROFILE_UUID', UUID);

                // set the provisioning profile output variable.
                tl.setVariable('provProfileUuid', UUID);
            }
        }

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();