import path = require('path');
import tl = require('vsts-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        let removeProfile: boolean = tl.getBoolInput('removeProfile');
        if (removeProfile) {
            let profileUUID: string = tl.getTaskVariable('APPLE_PROV_PROFILE_UUID');
            if (profileUUID) {
                await sign.deleteProvisioningProfile(profileUUID);
            }
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();