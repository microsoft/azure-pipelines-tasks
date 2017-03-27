import path = require('path');
import tl = require('vsts-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        var provProfile = tl.getInput('provProfile', true);

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();