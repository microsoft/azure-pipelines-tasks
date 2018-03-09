import * as fs from 'fs';
import * as path from 'path';
import * as ps from 'child_process';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as models from './models';
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
    constructor(dtaTestConfig: models.DtaTestConfigurations) {
        this.dtaPid = -1;
        this.dtaTestConfig = dtaTestConfig;
        this.testSourcesFile = null;
    }

    public runDistributedTest() {
        this.publishCodeChangesIfRequired();
        this.invokeDtaExecutionHost();
    }

    private publishCodeChangesIfRequired(): void {
        if (this.dtaTestConfig.tiaConfig.tiaEnabled) {
            const code = testSelector.publishCodeChanges(this.dtaTestConfig.tiaConfig, this.dtaTestConfig.proxyConfiguration, null, this.dtaTestConfig.taskInstanceIdentifier);
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
            ci.publishEvent({ environmenturi: this.dtaTestConfig.dtaEnvironment.environmentUri, error: error });
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, error);
        }
    }

    private async startDtaExecutionHost(): Promise<number> {
        this.testSourcesFile = this.createTestSourcesFile();

        const inputDataContract = <models.InputDataContract>{};

        // CoreInputs
        inputDataContract.AgentName = this.dtaTestConfig.dtaEnvironment.agentName;
        inputDataContract.CollectionUri = this.dtaTestConfig.dtaEnvironment.tfsCollectionUrl;
        inputDataContract.EnvironmentUri = this.dtaTestConfig.dtaEnvironment.environmentUri;
        inputDataContract.TeamProject = tl.getVariable('System.TeamProject');

        // InputDataContract.TestSelectionSettings
        inputDataContract.TestSelectionSettings = <models.TestSelectionSettings>{};
        inputDataContract.TestSelectionSettings.TestCaseFilter = this.dtaTestConfig.testcaseFilter;
        inputDataContract.TestSelectionSettings.SearchFolder = this.dtaTestConfig.testDropLocation;
        inputDataContract.TestSelectionSettings.TestSelectionType = this.dtaTestConfig.testSelection;
        inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.OnDemandTestRunId = utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.onDemandTestRunId) ? null : Number(this.dtaTestConfig.onDemandTestRunId);

        // InputDataContract.TestSelectionSettings.AssemblyBasedTestSelection
        inputDataContract.TestSelectionSettings.AssemblyBasedTestSelection = <models.AssemblyBasedTestSelection>{};
        inputDataContract.TestSelectionSettings.AssemblyBasedTestSelection.SourceFilter = this.dtaTestConfig.sourceFilter.join('|');

        // InputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings
        inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings = <models.TestPlanTestSuiteSettings>{};
        inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.Testplan = this.dtaTestConfig.testplan;
        inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.TestPlanConfigId = this.dtaTestConfig.testPlanConfigId;
        if (!utils.Helper.isNullOrUndefined(this.dtaTestConfig.testSuites)) {
            inputDataContract.TestSelectionSettings.TestPlanTestSuiteSettings.TestSuites = this.dtaTestConfig.testSuites;
        }

        // InputDataContract.TestReportingSettings
        inputDataContract.TestReportingSettings = <models.TestReportingSettings>{};
        inputDataContract.TestReportingSettings.TestRunTitle = this.dtaTestConfig.testRunTitle;

        // InputDataContract.TfsSpecificSettings
        inputDataContract.TfsSpecificSettings = <models.TfsSpecificSettings>{};
        inputDataContract.TfsSpecificSettings.BuildId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Build.Buildid')) ? null : Number(tl.getVariable('Build.Buildid'));
        inputDataContract.TfsSpecificSettings.BuildUri = tl.getVariable('Build.BuildUri');
        inputDataContract.TfsSpecificSettings.ReleaseId = utils.Helper.isNullEmptyOrUndefined(tl.getVariable('Release.ReleaseId')) ? null : Number(tl.getVariable('Release.ReleaseId'));
        inputDataContract.TfsSpecificSettings.ReleaseUri = tl.getVariable('Release.ReleaseUri');

        // InputDataContract.TargetBinariesSettings
        inputDataContract.TargetBinariesSettings = <models.TargetBinariesSettings>{};
        inputDataContract.TargetBinariesSettings.BuildConfig = this.dtaTestConfig.buildConfig;
        inputDataContract.TargetBinariesSettings.BuildPlatform = this.dtaTestConfig.buildPlatform;

        // InputDataContract.TargetBinariesSettings
        if (!utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.proxyConfiguration.proxyUrl)) {
            inputDataContract.ProxySettings = <models.ProxySettings>{};
            inputDataContract.ProxySettings.ProxyUrl = this.dtaTestConfig.proxyConfiguration.proxyUrl;
            inputDataContract.ProxySettings.ProxyUsername = this.dtaTestConfig.proxyConfiguration.proxyUserName;
            inputDataContract.ProxySettings.ProxyPassword =  this.dtaTestConfig.proxyConfiguration.proxyPassword;
            inputDataContract.ProxySettings.ProxyBypassHosts = this.dtaTestConfig.proxyConfiguration.proxyBypassHosts;
        }

        // InputDataContract.DistributionSettings
        inputDataContract.DistributionSettings = <models.DistributionSettings>{};
        if (this.dtaTestConfig.batchingType === models.BatchingType.AssemblyBased) {
            inputDataContract.DistributionSettings.TestCaseLevelSlicingEnabled = false;
        } else {
            inputDataContract.DistributionSettings.TestCaseLevelSlicingEnabled = true;
        }
        tl.debug('Type of batching' + this.dtaTestConfig.batchingType);
        inputDataContract.DistributionSettings.NumberOfTestAgents = this.dtaTestConfig.numberOfAgentsInPhase;
        const isTimeBasedBatching = (this.dtaTestConfig.batchingType === models.BatchingType.TestExecutionTimeBased);
        tl.debug('isTimeBasedBatching : ' + isTimeBasedBatching);
        inputDataContract.DistributionSettings.IsTimeBasedSlicing = isTimeBasedBatching;
        if (isTimeBasedBatching && this.dtaTestConfig.runningTimePerBatchInMs) {
            tl.debug('[RunStatistics] Run Time per batch' + this.dtaTestConfig.runningTimePerBatchInMs);
            inputDataContract.DistributionSettings.RunTimePerSlice = utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.runningTimePerBatchInMs) ? null : Number(this.dtaTestConfig.runningTimePerBatchInMs);
        }
        if (this.dtaTestConfig.numberOfTestCasesPerSlice) {
            inputDataContract.DistributionSettings.NumberOfTestCasesPerSlice = this.dtaTestConfig.numberOfTestCasesPerSlice;
        }

        // InputDataContract.ExecutionSettings
        inputDataContract.ExecutionSettings = <models.ExecutionSettings>{};
        inputDataContract.ExecutionSettings.VideoDataCollectorEnabled = this.dtaTestConfig.videoCoverageEnabled;
        inputDataContract.ExecutionSettings.IsToolsInstallerFlow = utils.Helper.isToolsInstallerFlow(this.dtaTestConfig);
        inputDataContract.ExecutionSettings.OverridenParameters = this.dtaTestConfig.overrideTestrunParameters;
        inputDataContract.ExecutionSettings.ProceedAfterAbortedTestCase = this.dtaTestConfig.proceedAfterAbortedTestCase;
        inputDataContract.ExecutionSettings.SettingsFile = this.dtaTestConfig.settingsFile;
        inputDataContract.ExecutionSettings.IgnoreTestFailures = this.dtaTestConfig.ignoreTestFailures.toLowerCase() === 'true';
        inputDataContract.ExecutionSettings.CodeCoverageEnabled = this.dtaTestConfig.codeCoverageEnabled;
        if (this.dtaTestConfig.pathtoCustomTestAdapters) {
            const testAdapters = tl.findMatch(this.dtaTestConfig.pathtoCustomTestAdapters, '**\\*TestAdapter.dll');
            if (!testAdapters || (testAdapters && testAdapters.length === 0)) {
                tl.warning(tl.loc('pathToCustomAdaptersContainsNoAdapters', this.dtaTestConfig.pathtoCustomTestAdapters));
            }
            inputDataContract.ExecutionSettings.CustomTestAdapters =  this.dtaTestConfig.pathtoCustomTestAdapters;
        }

        // InputDataContract.ExecutionSettings.TiaSettings
        inputDataContract.ExecutionSettings.TiaSettings = <models.TiaSettings>{};
        inputDataContract.ExecutionSettings.TiaSettings.Enabled = this.dtaTestConfig.tiaConfig.tiaEnabled;
        inputDataContract.ExecutionSettings.TiaSettings.RebaseLimit = utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.tiaConfig.tiaRebaseLimit) ? null : Number(this.dtaTestConfig.tiaConfig.tiaRebaseLimit);
        inputDataContract.ExecutionSettings.TiaSettings.SourcesDirectory = this.dtaTestConfig.tiaConfig.sourcesDir;
        inputDataContract.ExecutionSettings.TiaSettings.FileLevel = utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.tiaConfig.fileLevel) || this.dtaTestConfig.tiaConfig.fileLevel.toLowerCase() !== 'false';
        inputDataContract.ExecutionSettings.TiaSettings.FilterPaths = this.dtaTestConfig.tiaConfig.tiaFilterPaths;
        inputDataContract.ExecutionSettings.TiaSettings.UserMapFile = this.dtaTestConfig.tiaConfig.userMapFile;

        // InputDataContract.ExecutionSettings.RerunSettings
        inputDataContract.ExecutionSettings.RerunSettings = <models.RerunSettings>{};
        if (this.dtaTestConfig.rerunFailedTests) {
            inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests = true;
            tl.debug('Type of rerun: ' + this.dtaTestConfig.rerunType);
            if (this.dtaTestConfig.rerunType === 'basedOnTestFailureCount') {
                inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTestCasesMaxLimit = this.dtaTestConfig.rerunFailedTestCasesMaxLimit;
            } else {
                inputDataContract.ExecutionSettings.RerunSettings.RerunFailedThreshold = this.dtaTestConfig.rerunFailedThreshold;
            }
            inputDataContract.ExecutionSettings.RerunSettings.RerunMaxAttempts = this.dtaTestConfig.rerunMaxAttempts;
        }

        // InputDataContract.TfsSpecificSettings
        inputDataContract.TestSpecificSettings = <models.TestSpecificSettings>{};
        inputDataContract.TestSpecificSettings.TestCaseAccessToken = tl.getVariable('Test.TestCaseAccessToken');

        // InputDataContract.Logging
        inputDataContract.Logging = <models.Logging>{};
        inputDataContract.Logging.EnableConsoleLogs = true;
        if (utils.Helper.isDebugEnabled()) {
            inputDataContract.Logging.DebugLogging = true;
        }

        // TemporaryInputs
        inputDataContract.UseNewCollector = this.dtaTestConfig.tiaConfig.useNewCollector;
        inputDataContract.IsPrFlow = this.dtaTestConfig.tiaConfig.isPrFlow.toLowerCase() === 'true';
        inputDataContract.UseTestCaseFilterInResponseFile = this.dtaTestConfig.tiaConfig.useTestCaseFilterInResponseFile.toLowerCase() === 'true';
        inputDataContract.DisableEnablingDataCollector = this.dtaTestConfig.tiaConfig.disableEnablingDataCollector;
        inputDataContract.TiaBaseLineBuildIdFile = this.dtaTestConfig.tiaConfig.baseLineBuildIdFile;
        inputDataContract.VsVersion = this.dtaTestConfig.vsTestVersionDetails.majorVersion + '.' + this.dtaTestConfig.vsTestVersionDetails.minorversion + '.' + this.dtaTestConfig.vsTestVersionDetails.patchNumber;
        inputDataContract.VsVersionIsTestSettingsPropertiesSupported = this.dtaTestConfig.vsTestVersionDetails.isTestSettingsPropertiesSupported();
        inputDataContract.MiniMatchTestSourcesFile = this.testSourcesFile;
        inputDataContract.UseVsTestConsole = this.dtaTestConfig.useVsTestConsole.toLowerCase() === 'true';
        inputDataContract.TestPlatformVersion = this.dtaTestConfig.vsTestVersion;
        if (utils.Helper.isToolsInstallerFlow(this.dtaTestConfig)) {
            inputDataContract.COR_PROFILER_PATH_32 = this.dtaTestConfig.toolsInstallerConfig.x86ProfilerProxyDLLLocation;
            inputDataContract.COR_PROFILER_PATH_64 = this.dtaTestConfig.toolsInstallerConfig.x64ProfilerProxyDLLLocation;
            inputDataContract.ForcePlatformV2 = true;
        }
        // If we are setting the path version is not needed
        const exelocation = path.dirname(this.dtaTestConfig.vsTestVersionDetails.vstestExeLocation);
        tl.debug('Adding env var DTA.TestWindow.Path = ' + exelocation);
        const testWindowRelativeDir = 'CommonExtensions\\Microsoft\\TestWindow';
        if (exelocation && exelocation.indexOf(testWindowRelativeDir) !== -1) {
            const ideLocation = exelocation.split(testWindowRelativeDir)[0];
            tl.debug('Adding env var DTA.VisualStudio.Path = ' + ideLocation);
            inputDataContract.VisualStudioPath = ideLocation;
        } else {
            inputDataContract.VisualStudioPath = exelocation;
        }
        inputDataContract.TestWindowPath = exelocation;

        const settingsFile = this.dtaTestConfig.settingsFile;
        if (utils.Helper.pathExistsAsFile(settingsFile)) {
            tl.debug('Final runsettings file being used:');
            utils.Helper.readFileContents(settingsFile, 'utf-8').then(function (settings) {
                tl.debug('Running VsTest with settings : ');
                utils.Helper.printMultiLineLog(settings, (logLine) => { console.log('##vso[task.debug]' + logLine); });
            });
        }

        // Pass the acess token as an environment variable for security purposes
        // let envVars: { [key: string]: string; } = <{ [key: string]: string; }>{};
        const envVars: { [key: string]: string; } = process.env;
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', this.dtaTestConfig.dtaEnvironment.patToken);

        // Invoke DtaExecutionHost with the input json file
        const inputFilePath = path.join(tl.getVariable('temp'), 'input.json');
        DistributedTest.removeEmptyNodes(inputDataContract);
        writeFileSync(inputFilePath, JSON.stringify(inputDataContract));
        const dtaExecutionHostTool = tl.tool(path.join(__dirname, 'Modules/DTAExecutionHost.exe'));
        dtaExecutionHostTool.arg(['--inputFile', inputFilePath]);
        const code = await dtaExecutionHostTool.exec(<tr.IExecOptions>{ env: envVars });

        const consolidatedCiData = {
            agentFailure: false,
            agentPhaseSettings: tl.getVariable('System.ParallelExecutionType'),
            batchingType: models.BatchingType[this.dtaTestConfig.batchingType],
            batchSize: this.dtaTestConfig.numberOfTestCasesPerSlice,
            codeCoverageEnabled: this.dtaTestConfig.codeCoverageEnabled,
            dontDistribute: tl.getBoolInput('dontDistribute'),
            environmentUri: this.dtaTestConfig.dtaEnvironment.environmentUri,
            numberOfAgentsInPhase: this.dtaTestConfig.numberOfAgentsInPhase,
            overrideTestrunParameters: utils.Helper.isNullOrUndefined(this.dtaTestConfig.overrideTestrunParameters) ? 'false' : 'true',
            pipeline: tl.getVariable('release.releaseUri') != null ? 'release' : 'build',
            runTestsInIsolation: this.dtaTestConfig.runTestsInIsolation,
            runInParallel: this.dtaTestConfig.runInParallel,
            settingsType: !utils.Helper.isNullOrUndefined(this.dtaTestConfig.settingsFile) ? this.dtaTestConfig.settingsFile.endsWith('.runsettings') ? 'runsettings' : this.dtaTestConfig.settingsFile.endsWith('.testsettings') ? 'testsettings' : 'none' : 'none',
            task: 'VsTestDistributedFlow',
            testSelection: this.dtaTestConfig.testSelection,
            tiaEnabled: this.dtaTestConfig.tiaConfig.tiaEnabled,
            vsTestVersion: this.dtaTestConfig.vsTestVersionDetails.majorVersion + '.' + this.dtaTestConfig.vsTestVersionDetails.minorversion + '.' + this.dtaTestConfig.vsTestVersionDetails.patchNumber,
            rerunEnabled: this.dtaTestConfig.rerunFailedTests,
            rerunType: utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.rerunType) ? '' : this.dtaTestConfig.rerunType
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
            if (this.testSourcesFile) {
                tl.rmRF(this.testSourcesFile);
            }
        } catch (error) {
            //Ignore.
        }
        this.dtaPid = -1;
    }

    private createTestSourcesFile(): string {
        try {
            const sources = tl.findMatch(this.dtaTestConfig.testDropLocation, this.dtaTestConfig.sourceFilter);
            tl.debug('tl match count :' + sources.length);
            const filesMatching = [];
            sources.forEach(function (match: string) {
                if (!fs.lstatSync(match).isDirectory()) {
                    filesMatching.push(match);
                }
            });

            tl.debug('Files matching count :' + filesMatching.length);
            if (filesMatching.length === 0) {
                throw new Error(tl.loc('noTestSourcesFound', this.dtaTestConfig.sourceFilter.toString()));
            }

            const tempFile = path.join(os.tmpdir(), 'testSources_' + uuid.v1() + '.src');
            fs.writeFileSync(tempFile, filesMatching.join(os.EOL));
            tl.debug('Test Sources file :' + tempFile);
            return tempFile;
        } catch (error) {
            throw new Error(tl.loc('testSourcesFilteringFailed', error));
        }
    }

    private async cleanUp(temporarySettingsFile: string) {
        //cleanup the runsettings file
        if (temporarySettingsFile && this.dtaTestConfig.settingsFile !== temporarySettingsFile) {
            try {
                tl.rmRF(temporarySettingsFile);
            } catch (error) {
                //Ignore.
            }
        }
    }

    private dtaTestConfig: models.DtaTestConfigurations;
    private dtaPid: number;
    private testSourcesFile: string;
}