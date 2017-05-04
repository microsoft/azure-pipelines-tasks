import * as tl from 'vsts-task-lib/task';
import * as path from 'path';
import * as Q from 'q';
import * as models from './models';
import * as utils from './helpers';
import * as parameterParser from './parameterparser'
import * as os from 'os';
import * as fs from 'fs';

const xml2js = require('./node_modules/xml2js');
const uuid = require('node-uuid');

const parser = new xml2js.Parser();
const builder = new xml2js.Builder();
const headlessBuilder = new xml2js.Builder({headless: true});

const runSettingsExt = '.runsettings';
const testSettingsExt = '.testsettings';

const testSettingsAgentNameTag = 'agent-5d76a195-1e43-4b90-a6ce-4ec3de87ed25';
const testSettingsNameTag = 'testSettings-5d76a195-1e43-4b90-a6ce-4ec3de87ed25';
const testSettingsIDTag = '5d76a195-1e43-4b90-a6ce-4ec3de87ed25';
const testSettingsXmlnsTag = 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010'

//TestImpact collector
const testImpactFriendlyName = 'Test Impact';
const testImpactDataCollectorTemplate = '<DataCollector uri=\"datacollector://microsoft/TestImpact/1.0\" assemblyQualifiedName=\"Microsoft.VisualStudio.TraceCollector.TestImpactDataCollector, Microsoft.VisualStudio.TraceCollector, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a\" friendlyName=\"Test Impact\"><Configuration><RootPath></RootPath></Configuration></DataCollector>';

//Video collector
const videoCollectorFriendlyName = 'Screen and Voice Recorder';
const videoDataCollectorTemplate = '<DataCollector uri=\"datacollector://microsoft/VideoRecorder/1.0\" assemblyQualifiedName=\"Microsoft.VisualStudio.TestTools.DataCollection.VideoRecorder.VideoRecorderDataCollector, Microsoft.VisualStudio.TestTools.DataCollection.VideoRecorder, Version=14.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a\" friendlyName=\"Screen and Voice Recorder\"></DataCollector>';

//Parallel configuration
const runSettingsForParallel = '<?xml version="1.0" encoding="utf-8"?><RunSettings><RunConfiguration><MaxCpuCount>0</MaxCpuCount></RunConfiguration></RunSettings>';

const testSettingsTemplate = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>' +
'<TestSettings name=\"testSettings-5d76a195-1e43-4b90-a6ce-4ec3de87ed25\" id=\"5d76a195-1e43-4b90-a6ce-4ec3de87ed25\" xmlns=\"http://microsoft.com/schemas/VisualStudio/TeamTest/2010\">' +
  '<Execution>' +
    '<AgentRule name=\"agent-5d76a195-1e43-4b90-a6ce-4ec3de87ed25\">' +
      '<DataCollectors>' +
      '</DataCollectors>' +
    '</AgentRule>' +
  '</Execution>' +
'</TestSettings>';

const runSettingsTemplate = '<?xml version=\"1.0\" encoding=\"utf-8\"?>' +
'<RunSettings>' +
    '<DataCollectionRunSettings>' +
        '<DataCollectors>' +
        '</DataCollectors>' +
    '</DataCollectionRunSettings>' +
'</RunSettings>';

export async function updateSettingsFileAsRequired(settingsFile: string, isParallelRun: boolean, tiaConfig: models.TiaConfiguration, vsVersion: number, videoCollector: boolean, overrideParametersString: string) : Promise<string>
{
    const defer = Q.defer<string>();
    let result: any;

    if (!isParallelRun && !videoCollector && !tiaConfig.tiaEnabled && !overrideParametersString) {
        defer.resolve(settingsFile);
        return defer.promise;
    }

    //Get extension of settings file and contents
    let settingsExt = null;
    if (settingsFile && fs.lstatSync(settingsFile).isFile() && settingsFile.split('.').pop().toLowerCase() === 'testsettings') {
        settingsExt = testSettingsExt;
        result = await utils.Helper.getXmlContents(settingsFile);
        if (!result || result.TestSettings === undefined) {
            tl.warning(tl.loc('InvalidSettingsFile', settingsFile));
            settingsExt = null;
        }
    } else if (settingsFile && utils.Helper.pathExistsAsFile(settingsFile)) {
        settingsExt = runSettingsExt;
        result = await utils.Helper.getXmlContents(settingsFile);
        if (!result || result.RunSettings === undefined) {
            tl.warning(tl.loc('InvalidSettingsFile', settingsFile));
            settingsExt = null;
        }
    }

    if (overrideParametersString) {
        if (settingsExt === runSettingsExt) {
            result = updateRunSettingsWithParameters(result, overrideParametersString);
        } else {
            tl.warning(tl.loc('overrideNotSupported'));
        }
    }

    if (isParallelRun) {
        if (settingsExt === testSettingsExt) {
            tl.warning(tl.loc('RunInParallelNotSupported'));
        } else if (settingsExt === runSettingsExt) {
            tl.debug('Enabling run in parallel by editing given runsettings.');
            result = setupRunSettingsWithRunInParallel(result);
        } else {
            tl.debug('Enabling run in parallel by creating new runsettings.');
            settingsExt = runSettingsExt;
            result = await CreateSettings(runSettingsForParallel);
        }
    }

    if (videoCollector) {
        //Enable video collector only in test settings.
        let videoCollectorNode = null;
        parser.parseString(videoDataCollectorTemplate, function(err, data) {
            if (err) {
                defer.reject(err);
            }
            videoCollectorNode = data;
            });
        if (settingsExt === testSettingsExt) {
            tl.debug('Enabling video data collector by editing given testsettings.')
            result = updateTestSettingsWithDataCollector(result, videoCollectorFriendlyName, videoCollectorNode);
        } else if (settingsExt === runSettingsExt) {
            tl.warning(tl.loc('VideoCollectorNotSupportedWithRunSettings'));
        } else {
            tl.debug('Enabling video data collection by creating new test settings.')
            settingsExt = testSettingsExt;
            result = await CreateSettings(testSettingsTemplate);
            result = updateTestSettingsWithDataCollector(result, videoCollectorFriendlyName, videoCollectorNode)
        }
    }

    if (tiaConfig.tiaEnabled) {
        let testImpactCollectorNode = null;
        parser.parseString(testImpactDataCollectorTemplate, function(err, data) {
            if (err) {
                defer.reject(err);
            }
            testImpactCollectorNode = data;
            if (tiaConfig.useNewCollector) {
                testImpactCollectorNode.DataCollector.$.codebase = getTraceCollectorUri(vsVersion);
            }
            testImpactCollectorNode.DataCollector.Configuration[0].ImpactLevel = getTIALevel(tiaConfig);
            if (getTIALevel(tiaConfig) === 'file') {
                testImpactCollectorNode.DataCollector.Configuration[0].LogFilePath = 'true';
            }
            if (tiaConfig.context === 'CD') {
                testImpactCollectorNode.DataCollector.Configuration[0].RootPath = '';
            } else {
                testImpactCollectorNode.DataCollector.Configuration[0].RootPath = tiaConfig.sourcesDir;
            }
        });

        if (settingsExt === testSettingsExt) {
            tl.debug('Enabling Test Impact collector by editing given testsettings.')
            result = updateTestSettingsWithDataCollector(result, testImpactFriendlyName, testImpactCollectorNode);
        } else if (settingsExt === runSettingsExt) {
            tl.debug('Enabling Test Impact collector by editing given runsettings.')
            result = updateRunSettingsWithDataCollector(result, testImpactFriendlyName, testImpactCollectorNode);
        } else {
            tl.debug('Enabling test impact data collection by creating new runsettings.')
            settingsExt = runSettingsExt;
            result = await CreateSettings(runSettingsTemplate);
            result = updateRunSettingsWithDataCollector(result, testImpactFriendlyName, testImpactCollectorNode);
        }
    }

    if (result) {
        utils.Helper.writeXmlFile(result, settingsFile, settingsExt)
            .then(function (filename) {
                defer.resolve(filename);
            });
    } else {
        tl.debug('Not editing settings file. Using specified file as it is.')
        defer.resolve(settingsFile);
    }
    return defer.promise;
}

function updateRunSettingsWithParameters(result: any, overrideParametersString: string) {
    const overrideParameters = parameterParser.parse(overrideParametersString);
    if (result.RunSettings && result.RunSettings.TestRunParameters && result.RunSettings.TestRunParameters[0] &&
        result.RunSettings.TestRunParameters[0].Parameter) {
        tl.debug('Overriding test run parameters.');
        const parametersArray = result.RunSettings.TestRunParameters[0].Parameter;
        parametersArray.forEach(function (parameter) {
            const key = parameter.$.Name || parameter.$.name;
            if (overrideParameters[key] && overrideParameters[key].value) {
                if (parameter.$.Value) {
                    parameter.$.Value = overrideParameters[key].value;
                } else {
                    parameter.$.value = overrideParameters[key].value;
                }
            }
        });
    }
    return result;
}

function updateRunSettingsWithDataCollector(result: any, dataCollectorFriendlyName: string, dataCollectorNodeToAdd) {
    if (!result.RunSettings) {
        tl.debug('Updating runsettings file from RunSettings node');
        result.RunSettings = { DataCollectionRunSettings: { DataCollectors: dataCollectorNodeToAdd } };
    } else if (!result.RunSettings.DataCollectionRunSettings) {
        tl.debug('Updating runsettings file from DataCollectionSettings node');
        result.RunSettings.DataCollectionRunSettings = { DataCollectors: dataCollectorNodeToAdd };
    } else if (!result.RunSettings.DataCollectionRunSettings[0].DataCollectors) {
        tl.debug('Updating runsettings file from DataCollectors node');
        result.RunSettings.DataCollectionRunSettings[0] = { DataCollectors: dataCollectorNodeToAdd };
    } else {
        const dataCollectorArray = result.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector;
        if (!dataCollectorArray) {
            tl.debug('Updating runsettings file from DataCollector node');
            result.RunSettings.DataCollectionRunSettings[0] = { DataCollectors: dataCollectorNodeToAdd };
        } else {
            if (!isDataCollectorPresent(dataCollectorArray, dataCollectorFriendlyName)) {
                tl.debug('Updating runsettings file, adding a DataCollector node');
                dataCollectorArray.push(dataCollectorNodeToAdd.DataCollector);
            }
        }
    }
    return result;
}

function isDataCollectorPresent(dataCollectorArray, dataCollectorFriendlyName: string): Boolean {
    let found = false;
    for (const node of dataCollectorArray) {
        if (node.$.friendlyName && node.$.friendlyName.toUpperCase() === dataCollectorFriendlyName.toUpperCase()) {
            tl.debug('Data collector already present, will not add the node.');
            found = true;
            break;
        }
    }
    return found;
}

function updateTestSettingsWithDataCollector(result: any, dataCollectorFriendlyName: string, dataCollectorNodeToAdd) {    
    if (!result.TestSettings) {
        tl.debug('Updating testsettings file from TestSettings node');
        result.TestSettings = { Execution: { AgentRule: { DataCollectors:  dataCollectorNodeToAdd  } } };
        result.TestSettings.Execution.AgentRule.$ = { name: testSettingsAgentNameTag };
        result.TestSettings.$ = { name: testSettingsNameTag, id: testSettingsIDTag, xmlns: testSettingsXmlnsTag };
    } else if (!result.TestSettings.Execution) {
        tl.debug('Updating testsettings file from Execution node');
        result.TestSettings.Execution = { AgentRule: { DataCollectors:  dataCollectorNodeToAdd  } };
        result.TestSettings.Execution.AgentRule.$ = { name: testSettingsAgentNameTag };
    } else if (!result.TestSettings.Execution[0].AgentRule) {
        tl.debug('Updating testsettings file from AgentRule node');
        result.TestSettings.Execution[0] = { AgentRule: { DataCollectors: dataCollectorNodeToAdd  } };
        result.TestSettings.Execution[0].AgentRule.$ = { name: testSettingsAgentNameTag };
    } else if (!result.TestSettings.Execution[0].AgentRule[0].DataCollectors) {
        tl.debug('Updating testsettings file from DataCollectors node');
        result.TestSettings.Execution[0].AgentRule[0] = { DataCollectors: dataCollectorNodeToAdd };
        result.TestSettings.Execution[0].AgentRule.$ = { name: testSettingsAgentNameTag };
    } else {
        const dataCollectorArray = result.TestSettings.Execution[0].AgentRule[0].DataCollectors[0].DataCollector;
        if (!dataCollectorArray) {
            tl.debug('Updating testsettings file from DataCollector node');
            result.TestSettings.Execution[0].AgentRule[0].DataCollectors[0] = dataCollectorNodeToAdd;
        } else {
            if (!isDataCollectorPresent(dataCollectorArray, dataCollectorFriendlyName)) {
                tl.debug('Updating testsettings file, adding a DataCollector node');
                dataCollectorArray.push(dataCollectorNodeToAdd.DataCollector);
            }
        }
    }
    return result;
}

function CreateSettings(runSettingsContents: string) : Q.Promise<any> {
    const defer = Q.defer<any>();
    parser.parseString(runSettingsContents, function (err, result) {
        if (err) {
            defer.reject(err);
        }
        defer.resolve(result);
    });
    return defer.promise;
}

function setupRunSettingsWithRunInParallel(result: any) {
    const runInParallelNode = {MaxCpuCount: 0};
    if (!result.RunSettings.RunConfiguration || !result.RunSettings.RunConfiguration[0]) {
        tl.debug('Run configuration not found in the runsettings, so adding one with RunInParallel');
        result.RunSettings.RunConfiguration =  runInParallelNode ;
    } else if (!result.RunSettings.RunConfiguration[0].MaxCpuCount) {
        tl.debug('MaxCpuCount node not found in run configuration, so adding MaxCpuCount node');
        result.RunSettings.RunConfiguration[0].MaxCpuCount = 0;
    } else if (result.RunSettings.RunConfiguration[0].MaxCpuCount !== 0) {
        tl.debug('MaxCpuCount given in the runsettings file is not 0, so updating it to 0, given value :' 
                    + result.RunSettings.RunConfiguration[0].MaxCpuCount);
        result.RunSettings.RunConfiguration[0].MaxCpuCount = 0;
    }
    return result;
}

function getTraceCollectorUri(vsVersion: any): string {
    if (vsVersion === 15) {
        return 'file://' + path.join(__dirname, 'TestSelector/Microsoft.VisualStudio.TraceCollector.dll');
    } else {
        return 'file://' + path.join(__dirname, 'TestSelector/14.0/Microsoft.VisualStudio.TraceCollector.dll');
    }
}

function getTIALevel(tiaConfig: models.TiaConfiguration) {
    if (tiaConfig.fileLevel && tiaConfig.fileLevel.toUpperCase() === 'FALSE') {
        return 'method';
    }
    return 'file';
}