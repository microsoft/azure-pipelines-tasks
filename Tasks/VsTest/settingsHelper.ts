import tl = require('vsts-task-lib/task');
import path = require('path');
import Q = require('q');

var os = require('os');
var uuid = require('node-uuid');
var fs = require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var builder = new xml2js.Builder();
var headlessBuilder = new xml2js.Builder({headless: true});

const runSettingsExt = ".runsettings";
const testSettingsExt = ".testsettings";

const TestSettingsAgentNameTag = "agent-5d76a195-1e43-4b90-a6ce-4ec3de87ed25";
const TestSettingsNameTag = "testSettings-5d76a195-1e43-4b90-a6ce-4ec3de87ed25";
const TestSettingsIDTag = "5d76a195-1e43-4b90-a6ce-4ec3de87ed25";
const TestSettingsXmlnsTag = "http://microsoft.com/schemas/VisualStudio/TeamTest/2010"

//TestImpact collector
const TIFriendlyName = "Test Impact";
const TICollectorURI = "datacollector://microsoft/TestImpact/1.0";

//Video collector
const VideoCollectorFriendlyName="Screen and Voice Recorder";
const VideoDataCollectoTemplate= "<DataCollector uri=\"datacollector://microsoft/VideoRecorder/1.0\" assemblyQualifiedName=\"Microsoft.VisualStudio.TestTools.DataCollection.VideoRecorder.VideoRecorderDataCollector, Microsoft.VisualStudio.TestTools.DataCollection.VideoRecorder, Version=14.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a\" friendlyName=\"Screen and Voice Recorder\"></DataCollector>";
const testSettingsForVideoCollector="<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
"<TestSettings name=\"testSettings-5d76a195-1e43-4b90-a6ce-4ec3de87ed25\" id=\"5d76a195-1e43-4b90-a6ce-4ec3de87ed25\" xmlns=\"http://microsoft.com/schemas/VisualStudio/TeamTest/2010\">" +
  "<Execution>" +
    "<AgentRule name=\"agent-5d76a195-1e43-4b90-a6ce-4ec3de87ed25\">" +
      "<DataCollectors>" +
        "<DataCollector uri=\"datacollector://microsoft/VideoRecorder/1.0\" assemblyQualifiedName=\"Microsoft.VisualStudio.TestTools.DataCollection.VideoRecorder.VideoRecorderDataCollector, Microsoft.VisualStudio.TestTools.DataCollection.VideoRecorder, Version=14.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a\" friendlyName=\"Screen and Voice Recorder\">" +
        "</DataCollector>" +
      "</DataCollectors>" +
    "</AgentRule>" +
  "</Execution>" +
"</TestSettings>";

//Parallel configuration
var runSettingsForParallel = '<?xml version="1.0" encoding="utf-8"?><RunSettings><RunConfiguration><MaxCpuCount>0</MaxCpuCount></RunConfiguration></RunSettings>';

export async function updateSettingsFileAsRequired(settingsFile: string, isParallelRun: boolean, videoCollector: boolean, tiaEnabled: boolean) : Promise<string>
{
    var defer=Q.defer<string>();
    var result: any;

    //Get extension of settings file
    var settingsExt=runSettingsExt;
    if (settingsFile && fs.lstatSync(settingsFile).isFile() && settingsFile.split('.').pop().toLowerCase() === "testsettings") {
        settingsExt=testSettingsExt;
    }

    if (videoCollector) {
        //Enable video collector only in test settings.
        if (settingsExt === testSettingsExt) {
            tl.debug("Enabling video data collector by editing given testsettings.")
            var videoCollectorNode = null;
            parser.parseString(VideoDataCollectoTemplate, function(err, data){                
                videoCollectorNode = data;
            });
            result = await getXmlContents(settingsFile);
            result = await updateTestSettingsWithDataCollector(result, VideoCollectorFriendlyName, videoCollectorNode);
        } else if (isParallelRun) {
            tl.warning(tl.loc('ContradictorySettings'));
        } else {
            tl.debug("Enabling video data collection by creating new test settings.")
            settingsExt = testSettingsExt;
            result = await CreateSettings(testSettingsForVideoCollector);
        }
    }

    if (isParallelRun)
    {        
        if (settingsExt === testSettingsExt) {
            tl.warning(tl.loc('RunInParallelNotSupported'));
        } else if (!settingsFile || !pathExistsAsFile(settingsFile)) {
            tl.debug("Enabling run in parallel by creating new runsettings.");
            result = await CreateSettings(runSettingsForParallel);
        } else {
            tl.debug("Enabling run in parallel by editing given runsettings.")
            result = await getXmlContents(settingsFile);
            result = await setupRunSettingsFileForRunConfig(result, {MaxCpuCount: 0});
        }
    }

    if(tiaEnabled)
    {
        if(settingsExt === testSettingsExt)
        {

        } else if (!settingsFile || !pathExistsAsFile(settingsFile)) {

        } else {
            
        }
    }

    if (result) {
        writeXmlFile(result, settingsFile, settingsExt)
                    .then(function (filename) {
                        defer.resolve(filename);
                    });
    } else {
        defer.resolve(settingsFile);
    }
    return defer.promise;
}

function updateRunSettingsWithDataCollector(result: any, dataCollectorFriendlyName: string, dataCollectorNodeToAdd) {
    var dataCollectorNode = null;
    if (!result.RunSettings) {
        tl.debug("Updating runsettings file from RunSettings node");
        result.RunSettings = { DataCollectionRunSettings: { DataCollectors: dataCollectorNodeToAdd } };
    } else if (!result.RunSettings.DataCollectionRunSettings) {
        tl.debug("Updating runsettings file from DataCollectionSettings node");
        result.RunSettings.DataCollectionRunSettings = { DataCollectors: dataCollectorNodeToAdd };
    } else if (!result.RunSettings.DataCollectionRunSettings[0].DataCollectors) {
        tl.debug("Updating runsettings file from DataCollectors node");
        result.RunSettings.DataCollectionRunSettings[0] = { DataCollectors: dataCollectorNodeToAdd };
    } else {
        var dataCollectorArray = result.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector;
        if (!dataCollectorArray) {
            tl.debug("Updating runsettings file from DataCollector node");
            result.RunSettings.DataCollectionRunSettings[0] = { DataCollectors: dataCollectorNodeToAdd };
        } else {
            if (!isDataCollectorPresent(dataCollectorArray, dataCollectorFriendlyName)) {
                tl.debug("Updating runsettings file, adding a DataCollector node");
                dataCollectorArray.push(dataCollectorNodeToAdd.DataCollector);
            }
        }
    } 
}

function isDataCollectorPresent(dataCollectorArray, dataCollectorFriendlyName: string): Boolean {
    var found = false;    
    for (var node of dataCollectorArray) {
        if (node.$.friendlyName && node.$.friendlyName.toUpperCase() === dataCollectorFriendlyName.toUpperCase()) {
            tl.debug("Data collector already present, will not add the node.");
            found = true;
            break;
        }
    }
    return found;
}

function updateTestSettingsWithDataCollector(result: any, dataCollectorFriendlyName: string, dataCollectorNodeToAdd): Q.Promise<any> {
    var defer = Q.defer<any>();
    var dataCollectorNode = null;
    if (!result.TestSettings) {
        tl.debug("Updating testsettings file from TestSettings node");
        result.TestSettings = { Execution: { AgentRule: { DataCollectors:  dataCollectorNodeToAdd  } } };
        result.TestSettings.Execution.AgentRule.$ = { name: TestSettingsAgentNameTag };
        result.TestSettings.$ = { name: TestSettingsNameTag, id: TestSettingsIDTag, xmlns: TestSettingsXmlnsTag };
        defer.resolve(result);
    } else if (!result.TestSettings.Execution) {
        tl.debug("Updating testsettings file from Execution node");
        result.TestSettings.Execution = { AgentRule: { DataCollectors:  dataCollectorNodeToAdd  } };
        result.TestSettings.Execution.AgentRule.$ = { name: TestSettingsAgentNameTag };
        defer.resolve(result);
    } else if (!result.TestSettings.Execution[0].AgentRule) {
        tl.debug("Updating testsettings file from AgentRule node");
        result.TestSettings.Execution[0] = { AgentRule: { DataCollectors: dataCollectorNodeToAdd  } };
        result.TestSettings.Execution[0].AgentRule.$ = { name: TestSettingsAgentNameTag };
        defer.resolve(result);
    } else if (!result.TestSettings.Execution[0].AgentRule[0].DataCollectors) {
        tl.debug("Updating testsettings file from DataCollectors node");
        result.TestSettings.Execution[0].AgentRule[0] = { DataCollectors: dataCollectorNodeToAdd };
        result.TestSettings.Execution[0].AgentRule.$ = { name: TestSettingsAgentNameTag };
        defer.resolve(result);
    } else {
        var dataCollectorArray = result.TestSettings.Execution[0].AgentRule[0].DataCollectors[0].DataCollector;
        if (!dataCollectorArray) {
            tl.debug("Updating testsettings file from DataCollector node");
            result.TestSettings.Execution[0].AgentRule[0].DataCollectors[0] = dataCollectorNodeToAdd;
            defer.resolve(result);
        } else {
            if (!isDataCollectorPresent(dataCollectorArray, dataCollectorFriendlyName)) {
                tl.debug("Updating testsettings file, adding a DataCollector node");
                dataCollectorArray.push(dataCollectorNodeToAdd.DataCollector);
                defer.resolve(result);
            }
        }
    }
    return defer.promise;
}

function CreateSettings(runSettingsContents: string) : Q.Promise<any> {
    var defer=Q.defer<any>();
    parser.parseString(runSettingsContents, function (err, result) {
        if(err) {      
            defer.reject(err);
        }
        defer.resolve(result);                  
    });
    return defer.promise; 
}

function getXmlContents(filePath: string): Q.Promise<any> {
    var defer=Q.defer<any>();
    readFileContents(filePath, "utf-8")
        .then(function (xmlContents) {
            parser.parseString(xmlContents, function (err, result) {
                if (err) {
                    defer.reject(err);
                }
                else{
                    defer.resolve(result);
                }
            });
        });
        return defer.promise;
}

function setupRunSettingsFileForRunConfig(result: any, innerNode: any) : Q.Promise<any> {
    var defer=Q.defer<any>();  
    if (!result || result.RunSettings === undefined) {
        tl.warning(tl.loc('FailedToSetRunConfiguration'));
        defer.resolve(null);
    }
    if (!result.RunSettings) {
        result.RunSettings = { RunConfiguration: innerNode  };
    }
    else if (!result.RunSettings.RunConfiguration || !result.RunSettings.RunConfiguration[0]) {
        result.RunSettings.RunConfiguration =  innerNode ;
    }
    defer.resolve(result);
    return defer.promise;
}

function pathExistsAsFile(path: string) {
    return tl.exist(path) && tl.stats(path).isFile();
}

function saveToFile(fileContents: string, extension: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    var tempFile = path.join(os.tmpdir(), uuid.v1() + extension);
    fs.writeFile(tempFile, fileContents, function (err) {
        if (err) {
            defer.reject(err);
        }
        tl.debug("Temporary runsettings file created at " + tempFile);
        defer.resolve(tempFile);
    });
    return defer.promise;
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

function writeXmlFile(result: any, settingsFile: string, fileExt: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    var runSettingsForTestImpact = builder.buildObject(result);
    saveToFile(runSettingsForTestImpact, fileExt)
        .then(function (fileName) {
            defer.resolve(fileName);
            return defer.promise;
        })
        .fail(function (err) {
            defer.reject(err);
        });
    return defer.promise;
}

// function cleanUp(temporarySettingsFile: string) {
//     //cleanup the runsettings file
//     if (temporarySettingsFile && vstestConfig.runSettingsFile != temporarySettingsFile) {
//         try {
//             tl.rmRF(temporarySettingsFile, true);
//         } catch (error) {
//             //ignore. just cleanup.
//         }
//     }
// }