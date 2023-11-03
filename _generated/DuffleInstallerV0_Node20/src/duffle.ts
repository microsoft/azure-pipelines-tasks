"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as duffleInstaller from './duffleinstaller';

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));

async function configureDuffle() {
    const dufflePath = await duffleInstaller.setupDuffle();

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].toLowerCase().startsWith(path.dirname(dufflePath.toLowerCase()))) {
        toolLib.prependPath(path.dirname(dufflePath));
    }
}

configureDuffle().then(() => {
        tl.setResult(tl.TaskResult.Succeeded, '');
    }).catch((error) => {
        tl.setResult(tl.TaskResult.Failed, error);
});