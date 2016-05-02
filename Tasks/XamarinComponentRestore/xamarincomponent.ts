/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import os = require('os');
import fs = require('fs');

tl.setResourcePath(path.join( __dirname, 'task.json'));

var xamarinComponentExe = path.join(__dirname, "xpkg", "xamarin-component.exe")
var isWin = /^win/.test(process.platform);


var xamarinComponentTool;

if(isWin)
{
    xamarinComponentTool = tl.createToolRunner(xamarinComponentExe);
}
else
{
    xamarinComponentTool = tl.createToolRunner(tl.which('mono', true));
    xamarinComponentTool.arg(xamarinComponentExe);
}

xamarinComponentTool.arg('restore');
xamarinComponentTool.arg('-u');
xamarinComponentTool.arg(tl.getInput('email', true));
xamarinComponentTool.arg('-p');
xamarinComponentTool.arg(tl.getInput('password', true));

var solutionPath = tl.getPathInput('solution', true, false);
if(tl.filePathSupplied('solution'))
{
    var solutionMatches = tl.glob(solutionPath);
    tl.debug("Found " + solutionMatches.length + ' solutions matching.');
    
    if(solutionMatches.length > 0) {
        if(solutionMatches.length > 1) {
            tl.warning('multiple solution matches, using ' + solutionMatches[0]);
        }
        
        solutionPath = solutionMatches[0];
    }
} else {
    tl.debug('No solutions found');
}

tl.debug("Restoring components for " + solutionPath);

tl.cd(path.dirname(solutionPath));
xamarinComponentTool.arg(solutionPath);

xamarinComponentTool.exec()
.then(function(code) {
    tl.setResult(tl.TaskResult.Succeeded, tl.loc('XamarinComponentRestoreReturnCode', code));
})
.fin(function(code){
    var homeDir = process.env.HOME || process.env.USERPROFILE;
    var xamarinCredentials = path.join(homeDir, '.xamarin-credentials');
    if(fs.existsSync(xamarinCredentials))
    {
        tl.rmRF(xamarinCredentials, true);
    }
})
.fail(function(err) {
    tl.debug('taskRunner fail');
    tl.error( tl.loc('XamarinComponentRestoreFailed', err.message));
    tl.setResult(tl.TaskResult.Failed, tl.loc('XamarinComponentRestoreFailed', err.message));
})

    
