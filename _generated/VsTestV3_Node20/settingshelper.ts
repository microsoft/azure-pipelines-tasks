import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as Q from 'q';
import * as models from './models';
import * as utils from './helpers';
import * as parameterParser from './parameterparser'
import * as version from './vstestversion';
import * as fs from 'fs';

const xml2js = require('./node_modules/xml2js');
const uuid = require('uuid');

const parser = new xml2js.Parser();
const builder = new xml2js.Builder();
const headlessBuilder = new xml2js.Builder({ headless: true });

const runSettingsExtension = '.runsettings';
const testSettingsExtension = '.testsettings';

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

// TIA on for DTA Run
const runSettingsForTIAOn = '<?xml version="1.0" encoding="utf-8"?><RunSettings><RunConfiguration><TestImpact enabled=\"true\"></TestImpact><BaseLineRunId value=\"{0}\"></BaseLineRunId></RunConfiguration></RunSettings>';

const codeCoverageFriendlyName = 'Code Coverage';
const codeCoverageTemplate = '<DataCollector friendlyName="Code Coverage" uri="datacollector://Microsoft/CodeCoverage/2.0" assemblyQualifiedName="Microsoft.VisualStudio.Coverage.DynamicCoverageDataCollector, Microsoft.VisualStudio.TraceCollector, Version=11.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a"> <Configuration><CodeCoverage> <ModulePaths> <Include> <ModulePath>.*\.dll$</ModulePath> <ModulePath>.*\.exe$</ModulePath> </Include> <Exclude> <ModulePath>.*CPPUnitTestFramework.*</ModulePath> </Exclude> </ModulePaths> <Functions> <Exclude> <Function>^Fabrikam\.UnitTest\..*</Function> <Function>^std::.*</Function> <Function>^ATL::.*</Function> <Function>.*::__GetTestMethodInfo.*</Function> <Function>^Microsoft::VisualStudio::CppCodeCoverageFramework::.*</Function> <Function>^Microsoft::VisualStudio::CppUnitTestFramework::.*</Function> </Exclude> </Functions> <Attributes> <Exclude> <Attribute>^System\.Diagnostics\.DebuggerHiddenAttribute$</Attribute> <Attribute>^System\.Diagnostics\.DebuggerNonUserCodeAttribute$</Attribute> <Attribute>^System\.Runtime\.CompilerServices.CompilerGeneratedAttribute$</Attribute> <Attribute>^System\.CodeDom\.Compiler.GeneratedCodeAttribute$</Attribute> <Attribute>^System\.Diagnostics\.CodeAnalysis.ExcludeFromCodeCoverageAttribute$</Attribute> </Exclude> </Attributes> <Sources> <Exclude> <Source>.*\\atlmfc\\.*</Source> <Source>.*\\vctools\\.*</Source> <Source>.*\\public\\sdk\\.*</Source> <Source>.*\\microsoft sdks\\.*</Source> <Source>.*\\vc\\include\\.*</Source> </Exclude> </Sources> <CompanyNames> <Exclude> <CompanyName>.*microsoft.*</CompanyName> </Exclude> </CompanyNames> <PublicKeyTokens> <Exclude> <PublicKeyToken>^B77A5C561934E089$</PublicKeyToken> <PublicKeyToken>^B03F5F7F11D50A3A$</PublicKeyToken> <PublicKeyToken>^31BF3856AD364E35$</PublicKeyToken> <PublicKeyToken>^89845DCD8080CC91$</PublicKeyToken> <PublicKeyToken>^71E9BCE111E9429C$</PublicKeyToken> <PublicKeyToken>^8F50407C4E9E73B6$</PublicKeyToken> <PublicKeyToken>^E361AF139669C375$</PublicKeyToken> </Exclude> </PublicKeyTokens> <UseVerifiableInstrumentation>False</UseVerifiableInstrumentation> <AllowLowIntegrityProcesses>True</AllowLowIntegrityProcesses> <CollectFromChildProcesses>True</CollectFromChildProcesses> <CollectAspDotNet>False</CollectAspDotNet> </CodeCoverage> </Configuration> </DataCollector>';

const testSettingsTemplate = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
    <TestSettings name=\"testSettings-5d76a195-1e43-4b90-a6ce-4ec3de87ed25\" id=\"5d76a195-1e43-4b90-a6ce-4ec3de87ed25\" xmlns=\"http://microsoft.com/schemas/VisualStudio/TeamTest/2010\">
    <Execution>
    <AgentRule name=\"agent-5d76a195-1e43-4b90-a6ce-4ec3de87ed25\">
    <DataCollectors>
    </DataCollectors>
    </AgentRule>
    </Execution>
    </TestSettings>`;

const runSettingsTemplate = `<?xml version=\"1.0\" encoding=\"utf-8\"?> <RunSettings> <DataCollectionRunSettings> <DataCollectors> </DataCollectors> </DataCollectionRunSettings> </RunSettings>`;

export async function updateSettingsFileAsRequired(settingsFile: string, isParallelRun: boolean, tiaConfig: models.TiaConfiguration, vsVersion: version.VSTestVersion, videoCollector: boolean, overrideParametersString: string, isDistributedRun: boolean, codeCoverageToolsInstallerFlow: boolean): Promise<string> {
    const defer = Q.defer<string>();
    let result: any;

    if (!isParallelRun && !videoCollector && !tiaConfig.tiaEnabled && !overrideParametersString && !codeCoverageToolsInstallerFlow) {
        defer.resolve(settingsFile);
        return defer.promise;
    }

    //Get extension of settings file and contents
    let settingsExt = null;
    if (settingsFile && fs.lstatSync(settingsFile).isFile() && settingsFile.split('.').pop().toLowerCase() === 'testsettings') {
        settingsExt = testSettingsExtension;
        result = await utils.Helper.getXmlContents(settingsFile);
        if (!result || result.TestSettings === undefined) {
            tl.warning(tl.loc('InvalidSettingsFile', settingsFile));
            settingsExt = null;
        }
    } else if (settingsFile && utils.Helper.pathExistsAsFile(settingsFile)) {
        settingsExt = runSettingsExtension;
        result = await utils.Helper.getXmlContents(settingsFile);
        if (!result || result.RunSettings === undefined) {
            tl.warning(tl.loc('InvalidSettingsFile', settingsFile));
            settingsExt = null;
        }
    }

    if (settingsExt === testSettingsExtension && result.TestSettings &&
        result.TestSettings.Properties && result.TestSettings.Properties[0] &&
        result.TestSettings.Properties[0].Property && vsVersion && !vsVersion.isTestSettingsPropertiesSupported()) {
        tl.warning(tl.loc('testSettingPropertiesNotSupported'));
    }

    if (overrideParametersString) {
        if (settingsExt === runSettingsExtension || settingsExt === testSettingsExtension) {
            result = updateSettingsWithParameters(result, overrideParametersString);
        } else {
            tl.warning(tl.loc('overrideNotSupported'));
        }
    }

    if (isParallelRun) {
        if (settingsExt === testSettingsExtension) {
            tl.warning(tl.loc('RunInParallelNotSupported'));
        } else if (settingsExt === runSettingsExtension) {
            tl.debug('Enabling run in parallel by editing given runsettings.');
            result = setupRunSettingsWithRunInParallel(result);
        } else {
            tl.debug('Enabling run in parallel by creating new runsettings.');
            settingsExt = runSettingsExtension;
            result = await CreateSettings(runSettingsForParallel);
        }
    }

    if (videoCollector) {
        //Enable video collector only in test settings.
        let videoCollectorNode = null;
        parser.parseString(videoDataCollectorTemplate, function (err, data) {
            if (err) {
                defer.reject(err);
            }
            videoCollectorNode = data;
        });
        if (settingsExt === testSettingsExtension) {
            tl.debug('Enabling video data collector by editing given testsettings.')
            result = updateTestSettingsWithDataCollector(result, videoCollectorFriendlyName, videoCollectorNode);
        } else if (settingsExt === runSettingsExtension) {
            tl.warning(tl.loc('VideoCollectorNotSupportedWithRunSettings'));
        } else {
            tl.debug('Enabling video data collection by creating new test settings.')
            settingsExt = testSettingsExtension;
            result = await CreateSettings(testSettingsTemplate);
            result = updateTestSettingsWithDataCollector(result, videoCollectorFriendlyName, videoCollectorNode)
        }
    }

    if (tiaConfig.tiaEnabled && !tiaConfig.disableEnablingDataCollector) {
        let testImpactCollectorNode = null;
        parser.parseString(testImpactDataCollectorTemplate, function (err, data) {
            if (err) {
                defer.reject(err);
            }

            // Make both into an array to maintain parity with scenario where these are read from the xml file in which case they will be treated as arrays
            testImpactCollectorNode = [ data ];
            testImpactCollectorNode[0].DataCollector = [ testImpactCollectorNode[0].DataCollector ];

            if (tiaConfig.useNewCollector) {
                testImpactCollectorNode[0].DataCollector[0].$.codebase = getTraceCollectorUri(vsVersion.majorVersion);
            }

            testImpactCollectorNode[0].DataCollector[0].Configuration[0].ImpactLevel = getTIALevel(tiaConfig);
            testImpactCollectorNode[0].DataCollector[0].Configuration[0].LogFilePath = 'true';

            if (tiaConfig.context === 'CD') {
                testImpactCollectorNode[0].DataCollector[0].Configuration[0].RootPath = '';
            } else {
                testImpactCollectorNode[0].DataCollector[0].Configuration[0].RootPath = tiaConfig.sourcesDir;
            }
        });

        if (settingsExt === testSettingsExtension) {
            tl.debug('Enabling Test Impact collector by editing given testsettings.');
            result = updateTestSettingsWithDataCollector(result, testImpactFriendlyName, testImpactCollectorNode);
        } else if (settingsExt === runSettingsExtension) {
            tl.debug('Enabling Test Impact collector by editing given runsettings.');
            result = updateRunSettingsWithDataCollector(result, testImpactFriendlyName, testImpactCollectorNode);
        } else {
            tl.debug('Enabling test impact data collection by creating new runsettings.');
            settingsExt = runSettingsExtension;
            result = await CreateSettings(runSettingsTemplate);
            result = updateRunSettingsWithDataCollector(result, testImpactFriendlyName, testImpactCollectorNode);
        }
    }

    if (isDistributedRun && tiaConfig.tiaEnabled) {
        let baseLineRunId = utils.Helper.readFileContentsSync(tiaConfig.baseLineBuildIdFile, 'utf-8');
        if (settingsExt === testSettingsExtension) {
            tl.debug('Enabling tia in testsettings.');
            result = setupTestSettingsWithTestImpactOn(result, baseLineRunId);
        } else if (settingsExt === runSettingsExtension) {
            tl.debug('Enabling tia in runsettings.');
            result = setupRunSettingsWithTestImpactOn(result, baseLineRunId);
        } else {
            tl.debug('Enabling tia by creating new runsettings.');
            settingsExt = runSettingsExtension;
            var runsettingsWithBaseLineRunId = runSettingsForTIAOn.replace("{0}", baseLineRunId);
            result = await CreateSettings(runsettingsWithBaseLineRunId);
        }
    }

    if (codeCoverageToolsInstallerFlow) {
        let codeCoverageNode = null;
        tl.debug('Code coverage enabled in tools installer flow.');
        parser.parseString(codeCoverageTemplate, function (err, data) {
            if (err) {
                defer.reject(err);
            }
            codeCoverageNode = [ data ];
            codeCoverageNode[0].DataCollector = [ codeCoverageNode[0].DataCollector ];
        });

        if (settingsExt === testSettingsExtension) {
            tl.warning('Code coverage not supported with testsettings file when using tools installer.');
        } else if (settingsExt === runSettingsExtension) {
            tl.debug('Adding code coverage settings details to runsettings file.');
            updateRunSettingsWithCodeCoverageDetails(result, codeCoverageNode, settingsFile);
            tl.debug('Successfully added code coverage settings details to runsettings file.');
        } else {
            tl.debug('Enabling code coverage by creating new run settings.');
            settingsExt = runSettingsExtension;
            result = await CreateSettings(runSettingsTemplate);
            result = updateRunSettingsWithCodeCoverageDetails(result, codeCoverageNode, settingsFile);
            tl.debug('Successfully added code coverage settings details to runsettings file.');
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

function updateRunSettingsWithCodeCoverageDetails(result: any, codeCoverageNode: any, settingsFile: string) {
    if (!result.RunSettings) {
        tl.debug('Updating runsettings file from RunSettings node');
        result.RunSettings = { DataCollectionRunSettings: { DataCollectors: codeCoverageNode } };
    } else if (!result.RunSettings.DataCollectionRunSettings) {
        tl.debug('Updating runsettings file from DataCollectionSettings node');
        result.RunSettings.DataCollectionRunSettings = { DataCollectors: codeCoverageNode };
    } else if (!result.RunSettings.DataCollectionRunSettings[0].DataCollectors) {
        tl.debug('Updating runsettings file from DataCollectors node');
        result.RunSettings.DataCollectionRunSettings[0] = { DataCollectors: codeCoverageNode };
    } else {
        var dataCollectorArray;
        dataCollectorArray = result.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector;
        if (!dataCollectorArray) {
            tl.debug('Updating runsettings file from DataCollectors node');
            result.RunSettings.DataCollectionRunSettings[0] = { DataCollectors: codeCoverageNode };
        } else {
            if (!isDataCollectorPresent(dataCollectorArray, codeCoverageFriendlyName)) {
                tl.debug('Updating runsettings file, adding a DataCollector node');
                dataCollectorArray.push(codeCoverageNode[0].DataCollector[0]);
            }
            else {
                try {
                    setUseVerifiableInstrumentationToFalse(dataCollectorArray);
                } catch (error) {
                    throw new Error(tl.loc('InvalidSettingsFile', settingsFile));
                }
            }
        }
    }
    return result;
}

function updateSettingsWithParameters(result: any, overrideParametersString: string) {
    const overrideParameters = parameterParser.parse(overrideParametersString);
    var parametersArray;
    if (result.RunSettings) {
        if (result.RunSettings.TestRunParameters && result.RunSettings.TestRunParameters[0] &&
            result.RunSettings.TestRunParameters[0].Parameter) {
            tl.debug('Overriding test run parameters for run settings.');
            parametersArray = result.RunSettings.TestRunParameters[0].Parameter;
        }
    }
    else if (result.TestSettings) {
        if (result.TestSettings.Properties && result.TestSettings.Properties[0] &&
            result.TestSettings.Properties[0].Property) {
            tl.debug('Overriding test run parameters for test settings.');
            parametersArray = result.TestSettings.Properties[0].Property;
        }
    }

    if (parametersArray) {
        parametersArray.forEach(function (parameter) {
            const key = parameter.$.Name || parameter.$.name;
            if (overrideParameters[key] && overrideParameters[key].value) {
                tl.debug('Overriding value for parameter : ' + key);
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
        var dataCollectorArray;
        dataCollectorArray = result.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector; 
        if (!dataCollectorArray) {
            tl.debug('Updating runsettings file from DataCollectors node');
            result.RunSettings.DataCollectionRunSettings[0] = { DataCollectors: dataCollectorNodeToAdd };
        } else {
            if (!isDataCollectorPresent(dataCollectorArray, dataCollectorFriendlyName)) {
                tl.debug('Updating runsettings file, adding a DataCollector node');
                dataCollectorArray.push(dataCollectorNodeToAdd[0].DataCollector[0]);
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

function setUseVerifiableInstrumentationToFalse(dataCollectorArray: any) {
    for (const node of dataCollectorArray) {
        if (node.$.friendlyName && node.$.friendlyName.toUpperCase() === codeCoverageFriendlyName.toUpperCase()) {
            if (utils.Helper.isNullEmptyOrUndefined(node.Configuration)) {
                tl.debug('Updating runsettings file from CodeCoverage node');
                node.Configuration = { CodeCoverage: { UseVerifiableInstrumentation: 'False' } };
            } else if (utils.Helper.isNullEmptyOrUndefined(node.Configuration[0].CodeCoverage)) {
                node.Configuration.CodeCoverage = { UseVerifiableInstrumentation: 'False' };
                tl.debug('Updating runsettings file from UseVerifiableInstrumentation node');
            } else {
                node.Configuration[0].CodeCoverage[0].UseVerifiableInstrumentation = 'False';
                console.log(tl.loc('OverrideUseVerifiableInstrumentation'));
            }
        }
    }
}

function updateTestSettingsWithDataCollector(result: any, dataCollectorFriendlyName: string, dataCollectorNodeToAdd) {
    if (!result.TestSettings) {
        tl.debug('Updating testsettings file from TestSettings node');
        result.TestSettings = { Execution: { AgentRule: { DataCollectors: dataCollectorNodeToAdd } } };
        result.TestSettings.Execution.AgentRule.$ = { name: testSettingsAgentNameTag };
        result.TestSettings.$ = { name: testSettingsNameTag, id: testSettingsIDTag, xmlns: testSettingsXmlnsTag };
    } else if (!result.TestSettings.Execution) {
        tl.debug('Updating testsettings file from Execution node');
        result.TestSettings.Execution = { AgentRule: { DataCollectors: dataCollectorNodeToAdd } };
        result.TestSettings.Execution.AgentRule.$ = { name: testSettingsAgentNameTag };
    } else if (!result.TestSettings.Execution[0].AgentRule) {
        tl.debug('Updating testsettings file from AgentRule node');
        result.TestSettings.Execution[0] = { AgentRule: { DataCollectors: dataCollectorNodeToAdd } };
        result.TestSettings.Execution[0].AgentRule.$ = { name: testSettingsAgentNameTag };
    } else if (!result.TestSettings.Execution[0].AgentRule[0].DataCollectors) {
        tl.debug('Updating testsettings file from DataCollectors node');
        result.TestSettings.Execution[0].AgentRule[0] = { DataCollectors: dataCollectorNodeToAdd };
        result.TestSettings.Execution[0].AgentRule.$ = { name: testSettingsAgentNameTag };
    } else {
        var dataCollectorArray; 
        dataCollectorArray = result.TestSettings.Execution[0].AgentRule[0].DataCollectors[0].DataCollector;
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

function CreateSettings(runSettingsContents: string): Q.Promise<any> {
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
    const runInParallelNode = { MaxCpuCount: 0 };
    if (!result.RunSettings.RunConfiguration || !result.RunSettings.RunConfiguration[0]) {
        tl.debug('Run configuration not found in the runsettings, so adding one with RunInParallel');
        result.RunSettings.RunConfiguration = runInParallelNode;
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

function setupRunSettingsWithTestImpactOn(result: any, baseLineRunId: String) {
    var tiaNode = {
        TestImpact: {
            $: {
                enabled: true
            }
        },
        BaseLineRunId: {
            $: {
                value: baseLineRunId
            }
        },
    }

    if (!result.RunSettings.RunConfiguration) {
        tl.debug('Run configuration not found in the runsettings, so adding one with TestImpact on');
        result.RunSettings.RunConfiguration = tiaNode;
    } else if (!result.RunSettings.RunConfiguration[0]) {
        result.RunSettings.RunConfiguration.TestImpact = {};
        result.RunSettings.RunConfiguration.BaseLineRunId = {};
        result.RunSettings.RunConfiguration.TestImpact.$ = {};
        result.RunSettings.RunConfiguration.BaseLineRunId.$ = {};
        result.RunSettings.RunConfiguration.TestImpact.$.enabled = true;
        result.RunSettings.RunConfiguration.BaseLineRunId.$.value = baseLineRunId;
    } else {
        result.RunSettings.RunConfiguration[0].TestImpact = {};
        result.RunSettings.RunConfiguration[0].BaseLineRunId = {};
        result.RunSettings.RunConfiguration[0].TestImpact.$ = {};
        result.RunSettings.RunConfiguration[0].BaseLineRunId.$ = {};
        result.RunSettings.RunConfiguration[0].TestImpact.$.enabled = true;
        result.RunSettings.RunConfiguration[0].BaseLineRunId.$.value = baseLineRunId;
    }
    return result;
}

function setupTestSettingsWithTestImpactOn(result: any, baseLineRunId: String) {
    var tiaNode = {
        TestImpact: {
            $: {
                enabled: true
            }
        },
        BaseLineRunId: {
            $: {
                value: baseLineRunId
            }
        },
    }

    if (!result.TestSettings.Execution) {
        tl.debug('Execution not found in the testsettings, so adding one with TestImpact on');
        result.TestSettings.Execution = tiaNode;
    } else if (!result.TestSettings.Execution[0]) {
        result.TestSettings.Execution.TestImpact = {};
        result.TestSettings.Execution.BaseLineRunId = {};
        result.TestSettings.Execution.TestImpact.$ = {};
        result.TestSettings.Execution.BaseLineRunId.$ = {};
        result.TestSettings.Execution.TestImpact.$.enabled = true;
        result.TestSettings.Execution.BaseLineRunId.$.value = baseLineRunId;
    } else {
        result.TestSettings.Execution[0].TestImpact = {};
        result.TestSettings.Execution[0].BaseLineRunId = {};
        result.TestSettings.Execution[0].TestImpact.$ = {};
        result.TestSettings.Execution[0].BaseLineRunId.$ = {};
        result.TestSettings.Execution[0].TestImpact.$.enabled = true;
        result.TestSettings.Execution[0].BaseLineRunId.$.value = baseLineRunId;
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