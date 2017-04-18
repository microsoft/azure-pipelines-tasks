import path = require('path');
import tl = require('vsts-task-lib/task');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        let removeKey: boolean = tl.getBoolInput('removeKey');
        if (removeKey) {
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();