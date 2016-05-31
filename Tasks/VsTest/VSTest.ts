/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
var os = require('os');
import path = require('path');
import Q = require('q');
var regedit = require('regedit');
var uuid = require('node-uuid');
var fs = require('fs');
var xml2js = require('xml2js');

try{
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
    var publishRunAttachments: boolean = tl.getBoolInput('publisRunAttachments');
    var runInParallel: boolean = tl.getBoolInput('runInParallel');
    
    //Write-Host "##vso[task.logissue type=warning;TaskName=VSTest]"

    var sourcesDirectory = tl.getVariable('System.DefaultWorkingDirectory');
    var testAssemblyFiles = [];
    if(testAssembly.indexOf('*') >= 0 || testAssembly.indexOf('?') >= 0) {
        tl.debug('Pattern found in solution parameter.');
        var allFiles = tl.find(sourcesDirectory);
        testAssemblyFiles = tl.match(allFiles, testAssembly, {matchBase: true});
    }
    else{
        tl.debug('No Pattern found in solution parameter.');
        testAssembly.replace(';;', "`0")  // Borrowed from Legacy File Handler
        var assemblies = testAssembly.split(';');
        assemblies.forEach(function(assembly) {
            testAssemblyFiles.push(assembly);
        });
    }

    if (testAssemblyFiles && testAssemblyFiles.length != 0) {   
        var workingDirectory = path.join(sourcesDirectory, "..");     
        var testResultsDirectory = path.join(workingDirectory, 'TestResults');
        invokeVSTest().then(function(code){
            try{
                publishTestResults();
                tl.exit(code);
            }
            catch(error){
                //Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=VSTest]"
                throw error;
            }
        });
    }
    else {
        //Write-Host "##vso[task.logissue type=warning;code=002004;]"
        tl.warning("No test assemblies found matching the pattern: " + testAssembly);
    }
}
catch(error){
    //Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=VSTest]"
    throw error;
}

function invokeVSTest(): Q.Promise<number> {
    var defer = Q.defer<number>();
    if (vsTestVersion == "latest") {
        vsTestVersion = null;
    }
    locateVSVersion().then(function(vsVersion){
        setRunInParallellIfApplicable(vsVersion);
        setupRunSettingsFileForParallel().then(function(parallelRunSettingsFile){
            tl.rmRF(testResultsDirectory, true);
            var vsCommon = tl.getVariable("VS"+vsVersion+"0COMNTools");
            var vstestLocation = path.join(vsCommon, "..\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe");
            var vstest = tl.createToolRunner(vstestLocation);
            
            testAssemblyFiles.forEach(function(testAssembly) {
                var testAssemblyPath = testAssembly;
                //To maintain parity with the behaviour when test assembly was filepath, try to expand it relative to build sources directory.
                if(sourcesDirectory && !pathExistsAsFile(testAssembly)){
                    var expandedPath = path.join(sourcesDirectory, testAssembly);
                    if(pathExistsAsFile(expandedPath)){
                        testAssemblyPath = expandedPath;
                    }
                }
                vstest.arg(testAssemblyPath);  
            });
            
            if(testFiltercriteria){
                if(testFiltercriteria[0] == "\""){
                    vstest.arg("/TestCaseFilter:"+testFiltercriteria);
                }
                else{
                    vstest.arg("/TestCaseFilter:\""+testFiltercriteria+"\"");
                }
            }
             
            if(parallelRunSettingsFile && pathExistsAsFile(parallelRunSettingsFile)){
                tl.mkdirP(testResultsDirectory);
                if(overrideTestrunParameters){
                    
                }
                vstest.arg("/Settings:\"" + parallelRunSettingsFile + "\"");
            }
            
            if(codeCoverageEnabled){
                vstest.arg("/EnableCodeCoverage");
            }
            
            if(otherConsoleOptions){
                vstest.arg(otherConsoleOptions);
            }
            
            vstest.arg("/logger:trx");
            
            if(pathtoCustomTestAdapters){
                if(pathExistsAsDirectory(pathtoCustomTestAdapters)){                    
                    vstest.arg("/TestAdapterPath:\""+testFiltercriteria+"\"");
                }
                else{
                    vstest.arg("/TestAdapterPath:\""+path.dirname(testFiltercriteria)+"\"");
                }
            }
            else if(sourcesDirectory && isNugetRestoredAdapterPresent(sourcesDirectory)){
                vstest.arg("/TestAdapterPath:\""+sourcesDirectory+"\"");
            }
            
            tl.cd(workingDirectory);
            vstest.exec().then(function(code){
                defer.resolve(code);
            })
        });  
    });
    return defer.promise;
}

function publishTestResults(){
    if(testResultsDirectory){
        var allFilesInResultsDirectory = tl.find(testResultsDirectory);
        var resultFiles = tl.match(allFilesInResultsDirectory, "*.trx", {matchBase: true});   
        if (resultFiles && resultFiles.length != 0) { 
            var tp = new tl.TestPublisher("VSTest");
            tp.publish(resultFiles, true, platform, configuration, testRunTitle, publishRunAttachments);
        }
        else{
            //Write-Host "##vso[task.logissue type=warning;code=002003;]"
            tl.warning("No results found to publish.");
        }         
    }
}

function isNugetRestoredAdapterPresent(rootDirectory: string):boolean{
    var allFiles = tl.find(rootDirectory);
    var adapterFiles = tl.match(allFiles, "**\packages\**\*TestAdapter.dll", {matchBase: true});
    if(adapterFiles && adapterFiles.length != 0){
        adapterFiles.forEach(function(adapterFile){
           var packageIndex = adapterFile.indexOf('packages') + 7;
           var packageFolder = adapterFile.substr(0, packageIndex);
           var parentFolder = path.dirname(packageFolder);
           var solutionFiles = tl.match(allFiles, path.join(parentFolder, "*.sln"), {matchBase: true});
           if(solutionFiles && solutionFiles.length != 0){
               return true;
           }
        });
    }
    return false;
}

function setupRunSettingsFileForParallel(): Q.Promise<string>{    
    var defer = Q.defer<string>();           
    if(runInParallel){
        if(runSettingsFile.split('.').pop().toLowerCase() == "testsettings"){
            tl.warning("Run in Parallel is not supported with testsettings file."); 
            defer.resolve(runSettingsFile);           
        }
        else{
            if(!runSettingsFile || runSettingsFile.split('.').pop().toLowerCase() != "runsettings" || !pathExistsAsFile(runSettingsFile)){
                tl.debug("No settings file provided or the provided settings file does not exist.");
                var runSettingsForParallel =  '<?xml version="1.0" encoding="utf-8"?><RunSettings><RunConfiguration><MaxCpuCount>0</MaxCpuCount></RunConfiguration></RunSettings>';
                saveToFile(runSettingsForParallel).then(function(fileName){
                    defer.resolve(fileName);
                    return defer.promise;
                });
            }
            else{
                tl.debug("Adding maxcpucount element to runsettings file provided.");
                readFileContents(runSettingsFile, "utf-8").then(function(xmlContents){
                    var parser = new xml2js.Parser();
                    parser.parseString(xmlContents, function (err, result) {
                        if(!result.RunSettings){
                            result.RunSettings = {RunConfiguration :{ MaxCpuCount: 0 }};
                        }
                        else if(!result.RunSettings.RunConfiguration || result.RunSettings.RunConfiguration.length == 0 || result.RunSettings.RunConfiguration[0].length == 0){
                            result.RunSettings.RunConfiguration = { MaxCpuCount: 0 };
                        }
                        else{
                            var runConfigArray = result.RunSettings.RunConfiguration[0];
                            runConfigArray.MaxCpuCount = 0;
                        }
                        
                        var builder = new xml2js.Builder();
                        var runSettingsForParallel = builder.buildObject(result);
                        saveToFile(runSettingsForParallel).then(function(fileName){
                            defer.resolve(fileName);
                            return defer.promise;
                        });
                    });
                 });
            }
        }
    }
    else{
        defer.resolve(runSettingsFile);
    }
    
    return defer.promise;
}

function saveToFile(fileContents:string): Q.Promise<string> {    
    var defer = Q.defer<string>();           
    var tempFile = path.join(os.tmpdir(), uuid.v1()+".runsettings");
    fs.writeFile(tempFile, fileContents, function(err) {
        if(err) {
            defer.reject(err);
        }        
        tl.debug("Temporary runsettings file created at " + tempFile);
        defer.resolve(tempFile);
    }); 
    return defer.promise;
}

function setRunInParallellIfApplicable(vsVersion: number) {
    if(runInParallel){
        if(!isNaN(vsVersion) && vsVersion >= 14){  
            var vs14Common = tl.getVariable("VS140COMNTools");
            if ((vs14Common && pathExistsAsFile(path.join(vs14Common, "..\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\TE.TestModes.dll"))) || vsVersion > 14) {
                setRegistryKeyForParallelExecution(vsVersion);
                return;
            }
        }
    }
}

function resetRunInParallel(){
    tl.warning("Install Visual Studio 2015 Update 1 or higher on your build agent machine to run the tests in parallel.");
    runInParallel = false;
}

function locateVSVersion(): Q.Promise<number> {
    var defer = Q.defer<number>();
    var vsVersion = parseFloat(vsTestVersion);
    if(!isNaN(vsVersion)){
        defer.resolve(vsVersion);
        return defer.promise;
    }
    
    var regPath = "HKLM\\SOFTWARE\\Microsoft\\VisualStudio";
    regedit.list(regPath).on('data', function(entry) {
        if (entry && entry.data && entry.data.keys) {
            var subkeys = entry.data.keys;
            var versions = getFloatsFromStringArray(subkeys);
            if (versions && versions.length > 0) {
                versions.sort();
                defer.resolve(parseFloat(versions[versions.length - 1]));
                return defer.promise;
            }
        }
        defer.resolve(null);        
    });
    return defer.promise;
}

function getFloatsFromStringArray(inputArray: string[]): string[] {
    var outputArray: string[] = []
    var count;
    if (inputArray) {
        for (count = 0; count < inputArray.length; count++) {
            var floatValue = parseFloat(inputArray[count]);
            if (!isNaN(floatValue)) {
                outputArray.push(inputArray[count]);
            }
        }
    }
    return outputArray;
}   

function setRegistryKeyForParallelExecution(vsVersion: number){
    var regKey = "HKCU\\SOFTWARE\\Microsoft\\VisualStudio\\" + vsVersion.toFixed(1) + "_Config\\FeatureFlags\\TestingTools\\UnitTesting\\Taef";
    regedit.createKey(regKey, function(err){
        if(!err){
            var values = {
                [regKey]: {
                    'Value': {
                         value: '1',
                        type: 'REG_DWORD'
                    }
                }
            };
            regedit.putValue(values, function (err) { 
                if(err){
                    tl.warning("Error occured while setting registry key, Error: " + err);
                }   
            }); 
        }else{
            tl.warning("Error occured while creating registry key, Error: " + err);
        }
    });   
}

function readFileContents(filePath: string, encoding: string): Q.Promise<string> {
    var defer = Q.defer<string>();

    fs.readFile(filePath, encoding, (err, data) => {
        if (err) {
            defer.reject(new Error('Could not read file (' + filePath + '): ' + err.message));
        }
        else {
            defer.resolve(data);
        }
    });

    return defer.promise;
}

function pathExistsAsFile(path: string) {
    try {
        return tl.stats(path).isFile();
    }
    catch (error) {
        return false;
    }
}

function pathExistsAsDirectory(path: string) {
    try {
        return tl.stats(path).isDirectory();
    }
    catch (error) {
        return false;
    }
}