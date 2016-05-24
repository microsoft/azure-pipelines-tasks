/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');

var vsTestVersion: string = tl.getInput('vsTestVersion');
var testAssembly: string = tl.getInput('testAssembly', true);
var testFiltercriteria: string = tl.getInput('testFiltercriteria');
var runSettingsFile: string = tl.getPathInput('runSettingsFile');
var codeCoverageEnabled: boolean = tl.getBoolInput('codeCoverageEnabled');
var pathtoCustomTestAdapters: string = tl.getInput('pathtoCustomTestAdapters');
var overrideTestrunParameters: string = tl.getInput('overrideTestrunParameters');
var otherConsoleOptions: string = tl.getInput('otherConsoleOptions');
var testRunTitle: string = tl.getInput('testRunTitle');
var platform: string = tl.getInput('platform');
var configuration: string = tl.getInput('configuration');
var publishRunAttachments: boolean = tl.getBoolInput('publishRunAttachments');
var runInParallel: boolean = tl.getBoolInput('runInParallel');

//Write-Host "##vso[task.logissue type=warning;TaskName=VSTest]"

var sourcesDirectory = tl.getVariable('System.DefaultWorkingDirectory');
var testAssemblyFiles = [];
if (testAssembly.indexOf('*') >= 0 || testAssembly.indexOf('?') >= 0) {
    tl.debug('Pattern found in solution parameter.');
    var allFiles = tl.find(sourcesDirectory);
    testAssemblyFiles = tl.match(allFiles, testAssembly, {
        matchBase: true
    });
}
else {
    tl.debug('No Pattern found in solution parameter.');
    testAssembly.replace(';;', "`0") // Borrowed from Legacy File Handler
    var assemblies = testAssembly.split(';');
    assemblies.forEach(function(assembly){
        testAssemblyFiles.push(assembly);
    });
}

if(testAssemblyFiles && testAssemblyFiles.length != 0){
    invokeVSTest();
}
else{
     //Write-Host "##vso[task.logissue type=warning;code=002004;]"
    tl.warning("No test assemblies found matching the pattern: " + testAssembly)
}

function invokeVSTest() {
    var artifactDirectory = tl.getVariable('System.ArtifactsDirectory');
    var testResultsDirectory = path.join(artifactDirectory, 'TestResults');
    if(vsTestVersion == "latest"){
        vsTestVersion = null;
    }
    
    if(runInParallel && !isVisualStudio2015Update1OrHigherInstalled()){
        tl.warning("Install Visual Studio 2015 Update 1 or higher on your build agent machine to run the tests in parallel.");
        runInParallel = false;
    }
}

function isVisualStudio2015Update1OrHigherInstalled() : boolean {
    if(!vsTestVersion){
        vsTestVersion = locateVSVersion();
    }
    return false;
}
    
function locateVSVersion() : string{
    var regPath = "HKLM\\SOFTWARE\\Microsoft\\VisualStudio";
    regedit.list([regPath], function(err, entries) {
        tl.debug("+++++++++++++++++++++" + entries.length);
    })
    return "";
}    
