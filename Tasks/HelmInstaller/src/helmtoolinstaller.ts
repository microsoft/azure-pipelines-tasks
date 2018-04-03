"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import * as toolLib from 'vsts-task-tool-lib/tool';

import * as kubectlinstaller from "./kubectlinstaller"

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));

async function configureKubectl() {


    var version = await kubectlinstaller.getKuberctlVersion();
    var kubectlPath = await kubectlinstaller.downloadKubectl(version);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if(!process.env['PATH'].startsWith(path.dirname(kubectlPath))) {
        toolLib.prependPath(path.dirname(kubectlPath));
    }  
}

configureKubectl().then(()=>{
    tl.setResult(tl.TaskResult.Succeeded, "");
}, (reason) => {
    tl.setResult(tl.TaskResult.Failed, reason)
});