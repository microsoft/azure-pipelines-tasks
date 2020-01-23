import * as tl from 'azure-pipelines-task-lib/task';
import ps = require('process');
import util = require('./installsshkey-util');

async function run() {
    try {
        util.tryRestoreKnownHosts();

        let agentPid: string = tl.getTaskVariable(util.postKillAgentSetting);
        if (agentPid) {
            tl.debug('Killing SSH Agent PID: ' + agentPid);
            try {
                ps.kill(+agentPid);
            } catch (err) {
                // This gets cleaned up by the agent anyways, best effort
                tl.debug(`Killing SSH Agent failed with error: ${err}`);
            }
        } else {
            let deleteKey: string = tl.getTaskVariable(util.postDeleteKeySetting);
            let sshTool: util.SshToolRunner = new util.SshToolRunner();
            sshTool.deleteKey(deleteKey)
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();
