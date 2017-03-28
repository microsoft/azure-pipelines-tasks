import path = require('path');
import tl = require('vsts-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        var removeProfile = tl.getInput('removeProfile');
        if (removeProfile) {
            var UUID = tl.getTaskVariable("INSTALLED_PROV_PROFILE_UUID");
            if (UUID) {
                await sign.deleteProvisioningProfile(UUID);
            }
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();