import fs = require('fs');
import path = require('path');
import tl = require('vsts-task-lib/task');
import ps = require('process');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

import trm = require('vsts-task-lib/toolrunner');

function debugOutput(results: trm.IExecSyncResult) {
    tl.debug('stdout=' + results.stdout);
    tl.debug('stderr=' + results.stderr);
    tl.debug('code  =' + results.code);
    tl.debug('error =' + results.error);
}

async function run() {
    try {
        let external: string = 'C:\\Program Files\\Git\\usr\\bin\\';

        let results: trm.IExecSyncResult = tl.execSync('D:\\redist\\set.cmd', null);
        debugOutput(results);


        // Setup in Pre phase
        const postKillAgentSetting: string = 'INSTALL_SSH_KEY_KILL_SSH_AGENT_PID';
        const postDeleteKeySetting: string = 'INSTALL_SSH_KEY_DELETE_KEY';
        const postKnownHostsContentsSetting: string = 'INSTALL_SSH_KEY_KNOWN_HOSTS_CONTENTS';
        const postKnownHostsLocationSetting: string = 'INSTALL_SSH_KEY_KNOWN_HOSTS_LOCATION';

        let agentPid: string = tl.getTaskVariable(postKillAgentSetting);
        if (agentPid) {
            tl.debug('Killing SSH Agent PID: ' + agentPid);
            ps.kill(+agentPid);
        } else {
            let deleteKey: string = tl.getTaskVariable(postDeleteKeySetting);
            if (deleteKey) {
                tl.debug('Deleting Key: ' + deleteKey);
                tl.execSync(path.join(external, 'ssh-add.exe'), '-d ' + deleteKey);
            }
        }
        let knownHostsContents: string = tl.getTaskVariable(postKnownHostsContentsSetting);
        let knownHostsLocation: string = tl.getTaskVariable(postKnownHostsLocationSetting);
        tl.debug('Restoring known_hosts');
        if (knownHostsContents && knownHostsLocation) {
            fs.writeFileSync(knownHostsLocation, knownHostsContents);
        } else if (knownHostsLocation || knownHostsContents) {
            tl.warning('Inconsistency with known_hosts cannot reset (location=' + knownHostsLocation + ' content=' + knownHostsContents + ')');
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();