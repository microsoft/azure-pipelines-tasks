import * as fs from 'fs';
import * as path from 'path';
import * as ps from 'child_process';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as models from './models';
import * as constants from './constants';
import * as inputdatacontract from './inputdatacontract';
import * as settingsHelper from './settingshelper';
import * as utils from './helpers';
import * as ta from './testagent';
import * as versionFinder from './versionfinder';
import * as os from 'os';
import * as ci from './cieventlogger';
import { TestSelectorInvoker } from './testselectorinvoker';
import { writeFileSync } from 'fs';

const uuid = require('uuid');

const testSelector = new TestSelectorInvoker();

export class DistributedTest {
    constructor(inputDataContract: inputdatacontract.InputDataContract) {
        this.dtaPid = -1;
        this.inputDataContract = inputDataContract;
    }

    public runDistributedTest() {
        this.publishCodeChangesIfRequired();
        this.invokeDtaExecutionHost();
    }

    private publishCodeChangesIfRequired(): void {
        if (this.inputDataContract.ExecutionSettings.TiaSettings.Enabled) {

            // hydra: fix this
            const code = testSelector.publishCodeChangesInDistributedMode(this.inputDataContract);
            //todo: enable custom engine

            if (code !== 0) {
                tl.warning(tl.loc('ErrorWhilePublishingCodeChanges'));
            }
        }
    }

    private async invokeDtaExecutionHost() {
        try {
            const exitCode = await this.startDtaExecutionHost();
            tl.debug('DtaExecutionHost finished');

            if (exitCode !== 0) {
                tl.debug('Modules/DTAExecutionHost.exe process exited with code ' + exitCode);
                tl.setResult(tl.TaskResult.Failed, 'Modules/DTAExecutionHost.exe process exited with code ' + exitCode);
            } else {
                tl.debug('Modules/DTAExecutionHost.exe exited');
                tl.setResult(tl.TaskResult.Succeeded, 'Task succeeded');
            }
        } catch (error) {
            ci.publishEvent({ environmenturi: this.inputDataContract.RunIdentifier, error: error });
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, error);
        }
    }

    private async startDtaExecutionHost(): Promise<number> {

        // let envVars: { [key: string]: string; } = <{ [key: string]: string; }>{};
        const envVars: { [key: string]: string; } = process.env; // This is a temporary solution where we are passing parent process env vars, we should get away from this


        this.inputDataContract.TestSelectionSettings.TestSourcesFile = this.createTestSourcesFile();


        // Temporary solution till this logic can move to the test platform itself
        if (this.inputDataContract.UsingXCopyTestPlatformPackage) {
            const vsTestPackageLocation = tl.getVariable(constants.VsTestToolsInstaller.PathToVsTestToolVariable);

            // get path to Microsoft.IntelliTrace.ProfilerProxy.dll (amd64)
            let amd64ProfilerProxy = tl.findMatch(vsTestPackageLocation, '**\\amd64\\Microsoft.IntelliTrace.ProfilerProxy.dll');
            if (amd64ProfilerProxy && amd64ProfilerProxy.length !== 0) {

                envVars['COR_PROFILER_PATH_64'] = amd64ProfilerProxy[0];
            } else {
                // Look in x64 also for Microsoft.IntelliTrace.ProfilerProxy.dll (x64)
                amd64ProfilerProxy = tl.findMatch(vsTestPackageLocation, '**\\x64\\Microsoft.IntelliTrace.ProfilerProxy.dll');
                if (amd64ProfilerProxy && amd64ProfilerProxy.length !== 0) {

                    envVars['COR_PROFILER_PATH_64'] = amd64ProfilerProxy[0];
                } else {
                    utils.Helper.publishEventToCi(constants.AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1043, false);
                    tl.warning(tl.loc('testImpactAndCCWontWork'));
                }

                utils.Helper.publishEventToCi(constants.AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1042, false);
                tl.warning(tl.loc('testImpactAndCCWontWork'));
            }

            // get path to Microsoft.IntelliTrace.ProfilerProxy.dll (x86)
            const x86ProfilerProxy = tl.findMatch(vsTestPackageLocation, '**\\x86\\Microsoft.IntelliTrace.ProfilerProxy.dll');
            if (x86ProfilerProxy && x86ProfilerProxy.length !== 0) {
                    envVars['COR_PROFILER_PATH_32'] = x86ProfilerProxy[0];
            } else {
                utils.Helper.publishEventToCi(constants.AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1044, false);
                tl.warning(tl.loc('testImpactAndCCWontWork'));
            }
        }

        // const inputDataContract = <inputdatacontract.InputDataContract>{};

        // // CoreInputs
        // inputDataContract.AgentName = this.dtaTestConfig.dtaEnvironment.agentName;
        // inputDataContract.CollectionUri = this.dtaTestConfig.dtaEnvironment.tfsCollectionUrl;
        // inputDataContract.EnvironmentUri = this.dtaTestConfig.dtaEnvironment.environmentUri;
        // inputDataContract.TeamProject = tl.getVariable('System.TeamProject');

        // // InputDataContract.TestSelectionSettings
        // inputDataContract.TestSelectionSettings = <inputdatacontract.TestSelectionSettings>{};
        // inputDataContract.TestSelectionSettings.TestCaseFilter = this.dtaTestConfig.testcaseFilter;
        // inputDataContract.TestSelectionSettings.SearchFolder = this.dtaTestConfig.testDropLocation;
        // inputDataContract.TestSelectionSettings.TestSelectionType = this.dtaTestConfig.testSelection;

        // // InputDataContract.TestSelectionSettings.AssemblyBasedTestSelection
        // inputDataContract.TestSelectionSettings.AssemblyBasedTestSelection = <inputdatacontract.AssemblyBasedTestSelection>{};
        // inputDataContract.TestSelectionSettings.AssemblyBasedTestSelection.SourceFilter = this.dtaTestConfig.sourceFilter.join('|');

        // // InputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings
        // inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings = <inputdatacontract.TestPlanTestSuiteSettings>{};
        // inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.Testplan = this.dtaTestConfig.testplan;
        // inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.TestPlanConfigId = this.dtaTestConfig.testPlanConfigId;
        // inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.OnDemandTestRunId = utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.onDemandTestRunId) ? null : Number(this.dtaTestConfig.onDemandTestRunId);
        // if (!utils.Helper.isNullOrUndefined(this.dtaTestConfig.testSuites)) {
        //     inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.TestSuites = this.dtaTestConfig.testSuites;
        // }

        // // InputDataContract.TestReportingSettings
        // inputDataContract.TestReportingSettings = <inputdatacontract.TestReportingSettings>{};
        // inputDataContract.TestReportingSettings.TestRunTitle = this.dtaTestConfig.testRunTitle;

        // // InputDataContract.TfsSpecificSettings
        // inputDataContract.TfsSpecificSettings = <inputdatacontract.TfsSpecificSettings>{};
        // inputDataContract.TfsSpecificSettings.BuildId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Build.Buildid')) ? null : Number(tl.getVariable('Build.Buildid'));
        // inputDataContract.TfsSpecificSettings.BuildUri = tl.getVariable('Build.BuildUri');
        // inputDataContract.TfsSpecificSettings.ReleaseId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Release.ReleaseId')) ? null : Number(tl.getVariable('Release.ReleaseId'));
        // inputDataContract.TfsSpecificSettings.ReleaseUri = tl.getVariable('Release.ReleaseUri');

        // // InputDataContract.TargetBinariesSettings
        // inputDataContract.TargetBinariesSettings = <inputdatacontract.TargetBinariesSettings>{};
        // inputDataContract.TargetBinariesSettings.BuildConfig = this.dtaTestConfig.buildConfig;
        // inputDataContract.TargetBinariesSettings.BuildPlatform = this.dtaTestConfig.buildPlatform;

        // // InputDataContract.ProxySettings
        // if (!utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.proxyConfiguration.proxyUrl)) {
        //     inputDataContract.ProxySettings = <inputdatacontract.ProxySettings>{};
        //     inputDataContract.ProxySettings.ProxyUrl = this.dtaTestConfig.proxyConfiguration.proxyUrl;
        //     inputDataContract.ProxySettings.ProxyUsername = this.dtaTestConfig.proxyConfiguration.proxyUserName;
        //     inputDataContract.ProxySettings.ProxyPassword =  this.dtaTestConfig.proxyConfiguration.proxyPassword;
        //     inputDataContract.ProxySettings.ProxyBypassHosts = this.dtaTestConfig.proxyConfiguration.proxyBypassHosts;
        // }

        // // InputDataContract.DistributionSettings
        // inputDataContract.DistributionSettings = <inputdatacontract.DistributionSettings>{};
        // if (this.dtaTestConfig.batchingType === models.BatchingType.AssemblyBased) {
        //     inputDataContract.DistributionSettings.TestCaseLevelSlicingEnabled = false;
        // } else {
        //     inputDataContract.DistributionSettings.TestCaseLevelSlicingEnabled = true;
        // }
        // tl.debug('Type of batching' + this.dtaTestConfig.batchingType);
        // inputDataContract.DistributionSettings.NumberOfTestAgents = this.dtaTestConfig.numberOfAgentsInPhase;
        // const isTimeBasedBatching = (this.dtaTestConfig.batchingType === models.BatchingType.TestExecutionTimeBased);
        // tl.debug('isTimeBasedBatching : ' + isTimeBasedBatching);
        // inputDataContract.DistributionSettings.IsTimeBasedSlicing = isTimeBasedBatching;
        // if (isTimeBasedBatching && this.dtaTestConfig.runningTimePerBatchInMs) {
        //     tl.debug('[RunStatistics] Run Time per batch' + this.dtaTestConfig.runningTimePerBatchInMs);
        //     inputDataContract.DistributionSettings.RunTimePerSlice = utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.runningTimePerBatchInMs) ? null : Number(this.dtaTestConfig.runningTimePerBatchInMs);
        // }
        // if (this.dtaTestConfig.numberOfTestCasesPerSlice) {
        //     inputDataContract.DistributionSettings.NumberOfTestCasesPerSlice = this.dtaTestConfig.numberOfTestCasesPerSlice;
        // }

        // // InputDataContract.ExecutionSettings
        // inputDataContract.ExecutionSettings = <inputdatacontract.ExecutionSettings>{};
        // inputDataContract.ExecutionSettings.VideoDataCollectorEnabled = this.dtaTestConfig.videoCoverageEnabled;
        // inputDataContract.ExecutionSettings.IsToolsInstallerFlow = utils.Helper.isToolsInstallerFlow(this.dtaTestConfig);
        // inputDataContract.ExecutionSettings.OverridenParameters = this.dtaTestConfig.overrideTestrunParameters;
        // inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase = this.dtaTestConfig.proceedAfterAbortedTestCase;
        // inputDataContract.ExecutionSettings.SettingsFile = this.dtaTestConfig.settingsFile;
        // inputDataContract.ExecutionSettings.IgnoreTestFailures = utils.Helper.stringToBool(this.dtaTestConfig.ignoreTestFailures);
        // inputDataContract.ExecutionSettings.CodeCoverageEnabled = this.dtaTestConfig.codeCoverageEnabled;
        // if (this.dtaTestConfig.pathtoCustomTestAdapters) {
        //     const testAdapters = tl.findMatch(this.dtaTestConfig.pathtoCustomTestAdapters, '**\\*TestAdapter.dll');
        //     if (!testAdapters || (testAdapters && testAdapters.length === 0)) {
        //         tl.warning(tl.loc('pathToCustomAdaptersContainsNoAdapters', this.dtaTestConfig.pathtoCustomTestAdapters));
        //     }
        //     inputDataContract.ExecutionSettings.CustomTestAdapters =  this.dtaTestConfig.pathtoCustomTestAdapters;
        // }

        // // InputDataContract.ExecutionSettings.TiaSettings
        // inputDataContract.ExecutionSettings.TiaSettings = <inputdatacontract.TiaSettings>{};
        // inputDataContract.ExecutionSettings.TiaSettings.Enabled = this.dtaTestConfig.tiaConfig.tiaEnabled;
        // inputDataContract.ExecutionSettings.TiaSettings.RebaseLimit = utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.tiaConfig.tiaRebaseLimit) ? null : Number(this.dtaTestConfig.tiaConfig.tiaRebaseLimit);
        // inputDataContract.ExecutionSettings.TiaSettings.SourcesDirectory = this.dtaTestConfig.tiaConfig.sourcesDir;
        // inputDataContract.ExecutionSettings.TiaSettings.FileLevel = utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.tiaConfig.fileLevel) || this.dtaTestConfig.tiaConfig.fileLevel.toLowerCase() !== 'false';
        // inputDataContract.ExecutionSettings.TiaSettings.FilterPaths = this.dtaTestConfig.tiaConfig.tiaFilterPaths;
        // inputDataContract.ExecutionSettings.TiaSettings.UserMapFile = this.dtaTestConfig.tiaConfig.userMapFile;

        // // InputDataContract.ExecutionSettings.RerunSettings
        // inputDataContract.ExecutionSettings.RerunSettings = <inputdatacontract.RerunSettings>{};
        // if (this.dtaTestConfig.rerunFailedTests) {
        //     inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests = true;
        //     tl.debug('Type of rerun: ' + this.dtaTestConfig.rerunType);
        //     if (this.dtaTestConfig.rerunType === 'basedOnTestFailureCount') {
        //         inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTestCasesMaxLimit = this.dtaTestConfig.rerunFailedTestCasesMaxLimit;
        //     } else {
        //         inputDataContract.ExecutionSettings.RerunSettings.RerunFailedThreshold = this.dtaTestConfig.rerunFailedThreshold;
        //     }
        //     inputDataContract.ExecutionSettings.RerunSettings.RerunMaxAttempts = this.dtaTestConfig.rerunMaxAttempts;
        // }

        // // InputDataContract.TfsSpecificSettings
        // inputDataContract.TestSpecificSettings = <inputdatacontract.TestSpecificSettings>{};
        // inputDataContract.TestSpecificSettings.TestCaseAccessToken = tl.getVariable('Test.TestCaseAccessToken');

        // // InputDataContract.Logging
        // inputDataContract.Logging = <inputdatacontract.Logging>{};
        // inputDataContract.Logging.EnableConsoleLogs = true;
        // if (utils.Helper.isDebugEnabled()) {
        //     inputDataContract.Logging.DebugLogging = true;
        // }

        // // TemporaryInputs
        // inputDataContract.UseNewCollector = this.dtaTestConfig.tiaConfig.useNewCollector;
        // inputDataContract.IsPrFlow = utils.Helper.stringToBool(this.dtaTestConfig.tiaConfig.isPrFlow);
        // inputDataContract.UseTestCaseFilterInResponseFile = utils.Helper.stringToBool(this.dtaTestConfig.tiaConfig.useTestCaseFilterInResponseFile);
        // inputDataContract.DisableEnablingDataCollector = this.dtaTestConfig.tiaConfig.disableEnablingDataCollector;
        // inputDataContract.TiaBaseLineBuildIdFile = this.dtaTestConfig.tiaConfig.baseLineBuildIdFile;
        // inputDataContract.VsVersion = this.dtaTestConfig.vsTestVersionDetails.majorVersion + '.' + this.dtaTestConfig.vsTestVersionDetails.minorversion + '.' + this.dtaTestConfig.vsTestVersionDetails.patchNumber;
        // inputDataContract.VsVersionIsTestSettingsPropertiesSupported = this.dtaTestConfig.vsTestVersionDetails.isTestSettingsPropertiesSupported();
        // inputDataContract.MiniMatchTestSourcesFile = this.testSourcesFile;
        // inputDataContract.UseVsTestConsole =  utils.Helper.stringToBool(this.dtaTestConfig.useVsTestConsole);
        // inputDataContract.TestPlatformVersion = this.dtaTestConfig.vsTestVersion;
        // if (utils.Helper.isToolsInstallerFlow(this.dtaTestConfig)) {
        //     inputDataContract.COR_PROFILER_PATH_32 = this.dtaTestConfig.toolsInstallerConfig.x86ProfilerProxyDLLLocation;
        //     inputDataContract.COR_PROFILER_PATH_64 = this.dtaTestConfig.toolsInstallerConfig.x64ProfilerProxyDLLLocation;
        //     inputDataContract.ForcePlatformV2 = true;
        // }
        // // If we are setting the path version is not needed
        // const exelocation = path.dirname(this.dtaTestConfig.vsTestVersionDetails.vstestExeLocation);
        // tl.debug('Adding env var DTA.TestWindow.Path = ' + exelocation);
        // const testWindowRelativeDir = 'CommonExtensions\\Microsoft\\TestWindow';
        // if (exelocation && exelocation.indexOf(testWindowRelativeDir) !== -1) {
        //     const ideLocation = exelocation.split(testWindowRelativeDir)[0];
        //     tl.debug('Adding env var DTA.VisualStudio.Path = ' + ideLocation);
        //     inputDataContract.VisualStudioPath = ideLocation;
        // } else {
        //     inputDataContract.VisualStudioPath = exelocation;
        // }
        // inputDataContract.TestWindowPath = exelocation;

        // const settingsFile = this.dtaTestConfig.settingsFile;
        // if (utils.Helper.pathExistsAsFile(settingsFile)) {
        //     tl.debug('Final runsettings file being used:');
        //     utils.Helper.readFileContents(settingsFile, 'utf-8').then(function (settings) {
        //         tl.debug('Running VsTest with settings : ');
        //         utils.Helper.printMultiLineLog(settings, (logLine) => { console.log('##vso[task.debug]' + logLine); });
        //     });
        // }






        // Pass the acess token as an environment variable for security purposes
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', this.inputDataContract.AccessToken);
        this.inputDataContract.AccessToken = null;






        // Invoke DtaExecutionHost with the input json file
        const inputFilePath = path.join(tl.getVariable('temp'), 'input.json');
        DistributedTest.removeEmptyNodes(this.inputDataContract);
        writeFileSync(inputFilePath, JSON.stringify(this.inputDataContract));
        const dtaExecutionHostTool = tl.tool(path.join(__dirname, 'Modules/DTAExecutionHost.exe'));
        dtaExecutionHostTool.arg(['--inputFile', inputFilePath]);
        const code = await dtaExecutionHostTool.exec(<tr.IExecOptions>{ env: envVars });

        const consolidatedCiData = {
            agentFailure: false,
            agentPhaseSettings: tl.getVariable('System.ParallelExecutionType'),
            //batchingType: models.BatchingType[this.dtaTestConfig.batchingType],
            batchSize: this.inputDataContract.DistributionSettings.NumberOfTestCasesPerSlice,
            codeCoverageEnabled: this.inputDataContract.ExecutionSettings.CodeCoverageEnabled,
            dontDistribute: tl.getBoolInput('dontDistribute'),
            environmentUri: this.inputDataContract.RunIdentifier,
            numberOfAgentsInPhase: this.inputDataContract.DistributionSettings.NumberOfTestAgents,
            overrideTestrunParameters: utils.Helper.isNullOrUndefined(this.inputDataContract.ExecutionSettings.OverridenParameters) ? 'false' : 'true',
            pipeline: tl.getVariable('release.releaseUri') != null ? 'release' : 'build',
            runInParallel: this.inputDataContract.ExecutionSettings.AssemblyLevelParallelism,
            settingsType: !utils.Helper.isNullOrUndefined(this.inputDataContract.ExecutionSettings.SettingsFile) ? this.inputDataContract.ExecutionSettings.SettingsFile.endsWith('.runsettings') ? 'runsettings' : this.inputDataContract.ExecutionSettings.SettingsFile.endsWith('.testsettings') ? 'testsettings' : 'none' : 'none',
            task: 'VsTestDistributedFlow',
            testSelection: this.inputDataContract.TestSelectionSettings.TestSelectionType,
            tiaEnabled: this.inputDataContract.ExecutionSettings.TiaSettings.Enabled,
            rerunEnabled: this.inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests,
            rerunType: utils.Helper.isNullEmptyOrUndefined(tl.getInput('rerunType')) ? '' : tl.getInput('rerunType')
        };

        if (code !== 0) {
            consolidatedCiData.agentFailure = true;
        } else {
            tl.debug('Modules/DTAExecutionHost.exe exited');
        }

        ci.publishEvent(consolidatedCiData);
        this.cleanUpDtaExeHost();
        return code;
    }

    // Utility function used to remove empty or spurios nodes from the input json file
    public static removeEmptyNodes(obj: any) {
        if (obj === null || obj === undefined ) {
            return;
        }
        if (typeof obj !== 'object' && typeof obj !== undefined) {
            return;
        }
        const keys = Object.keys(obj);
        for (var index in Object.keys(obj)) {
            if (obj[keys[index]] && obj[keys[index]] != {}) {
                DistributedTest.removeEmptyNodes(obj[keys[index]]);
            }
            if (obj[keys[index]] == undefined || obj[keys[index]] == null || (typeof obj[keys[index]] == "object" && Object.keys(obj[keys[index]]).length == 0)) {
                delete obj[keys[index]];
            }
        }
    }

    private cleanUpDtaExeHost() {
        try {
            if (this.inputDataContract.TestSelectionSettings.TestSourcesFile) {
                tl.rmRF(this.inputDataContract.TestSelectionSettings.TestSourcesFile);
            }
        } catch (error) {
            //Ignore.
        }
        this.dtaPid = -1;
    }

    private createTestSourcesFile(): string {
        try {
            let sourceFilter = tl.getDelimitedInput('testAssemblyVer2', '\n', true);

            if (this.inputDataContract.TestSelectionSettings.TestSelectionType.toLowerCase() !== 'testassemblies') {
                sourceFilter = ['**\\*', '!**\\obj\\*'];
            }

            const sources = tl.findMatch(this.inputDataContract.TestSelectionSettings.SearchFolder, sourceFilter);
            tl.debug('tl match count :' + sources.length);
            const filesMatching = [];
            sources.forEach(function (match: string) {
                if (!fs.lstatSync(match).isDirectory()) {
                    filesMatching.push(match);
                }
            });

            tl.debug('Files matching count :' + filesMatching.length);
            if (filesMatching.length === 0) {
                throw new Error(tl.loc('noTestSourcesFound', sourceFilter.toString()));
            }

            const tempFile = utils.Helper.GenerateTempFile('testSources_' + uuid.v1() + '.src');
            fs.writeFileSync(tempFile, filesMatching.join(os.EOL));
            tl.debug('Test Sources file :' + tempFile);
            return tempFile;
        } catch (error) {
            throw new Error(tl.loc('testSourcesFilteringFailed', error));
        }
    }

    private inputDataContract: inputdatacontract.InputDataContract;
    private dtaPid: number;
}