import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');
import os = require('os');

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Check platform is macOS since demands are not evaluated on Hosted pools
        if (os.platform() !== 'darwin') {
            console.log(tl.loc('InstallRequiresMac'));
        } else {
            let removeProfile: boolean = tl.getBoolInput('removeProfile');
            if (removeProfile) {
                let profileUUID: string = tl.getTaskVariable('APPLE_PROV_PROFILE_UUID');
                if (profileUUID) {
                    await sign.deleteProvisioningProfile(profileUUID);
                }
            }
        }
    } catch (err) {
        tl.warning(err);
    }
}

run();