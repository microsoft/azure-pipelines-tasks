import path = require('path');
import tl = require('vsts-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        var provProfileSource = tl.getInput('provProfileSource', true);
        var provProfilePath;
        if(provProfileSource === 'SecureFile') {
            var provProfileSecureFile = tl.getInput('provProfileSecureFile', true);
            // TODO: download file to build temp folder and set provProfilePath
            provProfilePath = ''; 
        } else if (provProfileSource === 'Repo') {
            var provProfileFilePath = tl.getPathInput('provProfileFilePath', true);
            // TODO: check for wildcards, ensure one matching file found
            provProfilePath = provProfileFilePath;
        }

        var UUID = await sign.getProvisioningProfileUUID(provProfilePath);
        tl.setTaskVariable("INSTALLED_PROV_PROFILE_UUID", UUID);

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();