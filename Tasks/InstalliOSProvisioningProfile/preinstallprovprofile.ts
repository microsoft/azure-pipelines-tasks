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

        let provProfileSource: string = tl.getInput('provProfileSource', true);
        let provProfilePath: string;

        if (provProfileSource === 'SecureFile') {
            // file stored on server, download decrypted contents
            secureFileId = tl.getInput('provProfileSecureFile', true);
            secureFileHelpers = new secureFilesCommon.SecureFileHelpers();
            provProfilePath = secureFileHelpers.downloadSecureFile(secureFileId);
        } else if (provProfileSource === 'Repo') {
            // file stored in repository or build server
            let provProfileFilePath: string = tl.getPathInput('provProfileFilePath', true);
            let profiles: string[] = tl.findMatch(null, provProfileFilePath, null, null);
            if (!profiles || profiles.length === 0) {
                throw tl.loc('NO_PROVPROFILE_FOUND');
            } else if (profiles.length > 1) {
                throw tl.loc('MULTIPLE_PROVPROFILES_FOUND');
            } else {
                provProfilePath = profiles[0];
            }
        }

        if (tl.exist(provProfilePath)) {
            let UUID: string = await sign.getProvisioningProfileUUID(provProfilePath);
            tl.setTaskVariable("INSTALLED_PROV_PROFILE_UUID", UUID);
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