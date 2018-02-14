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
            var exitCode = await this.startDtaExecutionHost();
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
        const envVars: { [key: string]: string; } = process.env;
        this.testSourcesFile = this.createTestSourcesFile();
        tl.debug('Total env vars before setting DTA specific vars is :' + Object.keys(envVars).length);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', this.dtaTestConfig.dtaEnvironment.patToken);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AgentName', this.dtaTestConfig.dtaEnvironment.agentName);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.EnvironmentUri', this.dtaTestConfig.dtaEnvironment.environmentUri);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TeamFoundationCollectionUri', this.dtaTestConfig.dtaEnvironment.tfsCollectionUrl);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.MiniMatchTestSourcesFile', this.testSourcesFile);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.LocalTestDropPath', this.dtaTestConfig.testDropLocation);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.EnableConsoleLogs', 'true');
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.ProceedAfterAbortedTestCase',this.dtaTestConfig.proceedAfterAbortedTestCase.toString());
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.UseVsTestConsole', this.dtaTestConfig.useVsTestConsole);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TestPlatformVersion', this.dtaTestConfig.vsTestVersion);
        utils.Helper.addToProcessEnvVars(envVars, 'Test.TestCaseAccessToken', tl.getVariable('Test.TestCaseAccessToken'));

        if (utils.Helper.isToolsInstallerFlow(this.dtaTestConfig)) {
            utils.Helper.addToProcessEnvVars(envVars, 'COR_PROFILER_PATH_32', this.dtaTestConfig.toolsInstallerConfig.x86ProfilerProxyDLLLocation);
            utils.Helper.addToProcessEnvVars(envVars, 'COR_PROFILER_PATH_64', this.dtaTestConfig.toolsInstallerConfig.x64ProfilerProxyDLLLocation);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.ForcePlatformV2', 'true');
        }

        if (utils.Helper.isDebugEnabled()) {
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.EnableDiagLogs', 'true');
        }

        if (this.dtaTestConfig.pathtoCustomTestAdapters) {
            const testAdapters = tl.findMatch(this.dtaTestConfig.pathtoCustomTestAdapters, '**\\*TestAdapter.dll');
            if (!testAdapters || (testAdapters && testAdapters.length === 0)) {
                tl.warning(tl.loc('pathToCustomAdaptersContainsNoAdapters', this.dtaTestConfig.pathtoCustomTestAdapters));
            }
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.CustomTestAdapters', this.dtaTestConfig.pathtoCustomTestAdapters);
        }

        // Set proxy settings to environment if provided
        if (!utils.Helper.isNullEmptyOrUndefined(this.dtaTestConfig.proxyConfiguration.proxyUrl)) {
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.ProxyUrl', this.dtaTestConfig.proxyConfiguration.proxyUrl);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.ProxyUsername', this.dtaTestConfig.proxyConfiguration.proxyUserName);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.ProxyPassword', this.dtaTestConfig.proxyConfiguration.proxyPassword);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.ProxyBypassHosts', this.dtaTestConfig.proxyConfiguration.proxyBypassHosts);
        }

        // Adding Test Execution Host specific variables
        await this.addDtaTestRunEnvVars(envVars);

        // If we are setting the path version is not needed
        const exelocation = path.dirname(this.dtaTestConfig.vsTestVersionDetails.vstestExeLocation);
        tl.debug('Adding env var DTA.TestWindow.Path = ' + exelocation);

        // Split the TestWindow path out of full path - if we can't find it, will assume
        // that this is nuget/xcopyable package where the dlls are present in test window folder
        const testWindowRelativeDir = 'CommonExtensions\\Microsoft\\TestWindow';
        if (exelocation && exelocation.indexOf(testWindowRelativeDir) !== -1) {
            const ideLocation = exelocation.split(testWindowRelativeDir)[0];
            tl.debug('Adding env var DTA.VisualStudio.Path = ' + ideLocation);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.VisualStudio.Path', ideLocation);
        } else {
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.VisualStudio.Path', exelocation);
        }
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TestWindow.Path', exelocation);

        tl.debug('Total env vars set is ' + Object.keys(envVars).length);
        const dtaExecutionHostTool = tl.tool(path.join(__dirname, 'Modules/DTAExecutionHost.exe'));
        var code = await dtaExecutionHostTool.exec(<tr.IExecOptions>{ env: envVars });

        var consolidatedCiData = {
            agentFailure: false,
            agentPhaseSettings: tl.getVariable('System.ParallelExecutionType'),
            batchingType: models.BatchingType[this.dtaTestConfig.batchingType],
            batchSize: this.dtaTestConfig.numberOfTestCasesPerSlice,
            codeCoverageEnabled: this.dtaTestConfig.codeCoverageEnabled,
            dontDistribute: tl.getBoolInput('dontDistribute'),
            environmentUri: this.dtaTestConfig.dtaEnvironment.environmentUri,
            numberOfAgentsInPhase: this.dtaTestConfig.numberOfAgentsInPhase,
            overrideTestrunParameters: utils.Helper.isNullOrUndefined(this.dtaTestConfig.overrideTestrunParameters) ? 'false' : 'true',
            pipeline: tl.getVariable('release.releaseUri') != null ? "release" : "build",
            runTestsInIsolation: this.dtaTestConfig.runTestsInIsolation,
            runInParallel: this.dtaTestConfig.runInParallel,
            settingsType: !utils.Helper.isNullOrUndefined(this.dtaTestConfig.settingsFile) ? this.dtaTestConfig.settingsFile.endsWith('.runsettings') ? 'runsettings' : this.dtaTestConfig.settingsFile.endsWith('.testsettings') ? 'testsettings' : 'none' : 'none',
            task: "VsTestDistributedFlow",
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

    private async addDtaTestRunEnvVars(envVars: any) {
        utils.Helper.addToProcessEnvVars(envVars, 'TE.SourceFilter', this.dtaTestConfig.sourceFilter.join('|'));
        //Modify settings file to enable configurations and data collectors.
        let settingsFile = this.dtaTestConfig.settingsFile;
        try {
            settingsFile = await settingsHelper.updateSettingsFileAsRequired
                (this.dtaTestConfig.settingsFile, this.dtaTestConfig.runInParallel, this.dtaTestConfig.tiaConfig,
                this.dtaTestConfig.vsTestVersionDetails, false, this.dtaTestConfig.overrideTestrunParameters, true,
                this.dtaTestConfig.codeCoverageEnabled && utils.Helper.isToolsInstallerFlow(this.dtaTestConfig));

            //Reset override option so that it becomes a no-op in TaskExecutionHost
            this.dtaTestConfig.overrideTestrunParameters = null;
        } catch (error) {
            tl.warning(tl.loc('ErrorWhileUpdatingSettings'));
            tl.debug(error);
        }

        if (utils.Helper.pathExistsAsFile(settingsFile)) {
            tl.debug('Final runsettings file being used:');
            utils.Helper.readFileContents(settingsFile, 'utf-8').then(function (settings) {
                tl.debug('Running VsTest with settings : ');
                utils.Helper.printMultiLineLog(settings, (logLine) => { console.log('##vso[task.debug]' + logLine); });
            });
        }

        utils.Helper.addToProcessEnvVars(envVars, 'TE.TestCaseFilter', this.dtaTestConfig.testcaseFilter);
        utils.Helper.addToProcessEnvVars(envVars, 'TE.RunSettings', settingsFile);
        utils.Helper.addToProcessEnvVars(envVars, 'TE.TestDropLocation', this.dtaTestConfig.testDropLocation);
        utils.Helper.addToProcessEnvVars(envVars, 'TE.TestRunParams', this.dtaTestConfig.overrideTestrunParameters);
        utils.Helper.addToProcessEnvVars(envVars, 'TE.BuildConfig', this.dtaTestConfig.buildConfig);
        utils.Helper.addToProcessEnvVars(envVars, 'TE.BuildPlatform', this.dtaTestConfig.buildPlatform);
        utils.Helper.addToProcessEnvVars(envVars, 'TE.TestConfigurationMapping', this.dtaTestConfig.testConfigurationMapping);
        utils.Helper.addToProcessEnvVars(envVars, 'TE.TestRunTitle', this.dtaTestConfig.testRunTitle);
        utils.Helper.addToProcessEnvVars(envVars, 'TE.TestSelection', this.dtaTestConfig.testSelection);
        utils.Helper.addToProcessEnvVars(envVars, 'TE.TCMTestRun', this.dtaTestConfig.onDemandTestRunId);
        if (!utils.Helper.isNullOrUndefined(this.dtaTestConfig.testSuites)) {
            utils.Helper.addToProcessEnvVars(envVars, 'TE.TestSuites', this.dtaTestConfig.testSuites.join(','));
        }
        utils.Helper.setEnvironmentVariableToString(envVars, 'TE.IgnoreTestFailures', this.dtaTestConfig.ignoreTestFailures);

        if (!utils.Helper.isToolsInstallerFlow(this.dtaTestConfig)) {
            utils.Helper.setEnvironmentVariableToString(envVars, 'TE.CodeCoverageEnabled', this.dtaTestConfig.codeCoverageEnabled);
        }

        utils.Helper.setEnvironmentVariableToString(envVars, 'TE.TestPlan', this.dtaTestConfig.testplan);
        utils.Helper.setEnvironmentVariableToString(envVars, 'TE.TestPlanConfigId', this.dtaTestConfig.testPlanConfigId);

        if (this.dtaTestConfig.batchingType === models.BatchingType.AssemblyBased) {
            utils.Helper.setEnvironmentVariableToString(envVars, 'TE.CustomSlicingEnabled', 'false');
        }
        else {
            utils.Helper.setEnvironmentVariableToString(envVars, 'TE.CustomSlicingEnabled', 'true');
        }

        utils.Helper.setEnvironmentVariableToString(envVars, 'TE.MaxAgentPhaseSlicing', this.dtaTestConfig.numberOfAgentsInPhase.toString());
        tl.debug("Type of batching" + this.dtaTestConfig.batchingType);
        const isTimeBasedBatching = (this.dtaTestConfig.batchingType === models.BatchingType.TestExecutionTimeBased);
        tl.debug("isTimeBasedBatching : " + isTimeBasedBatching);
        utils.Helper.setEnvironmentVariableToString(envVars, 'TE.IsTimeBasedSlicing', isTimeBasedBatching.toString());
        if (isTimeBasedBatching && this.dtaTestConfig.runningTimePerBatchInMs) {
            tl.debug("[RunStatistics] Run Time per batch" + this.dtaTestConfig.runningTimePerBatchInMs);
            utils.Helper.setEnvironmentVariableToString(envVars, 'TE.SliceTime', this.dtaTestConfig.runningTimePerBatchInMs.toString());
        }
        if (this.dtaTestConfig.numberOfTestCasesPerSlice) {
            utils.Helper.setEnvironmentVariableToString(envVars, 'TE.NumberOfTestCasesPerSlice',
                this.dtaTestConfig.numberOfTestCasesPerSlice.toString());
        }

        if (this.dtaTestConfig.rerunFailedTests) {
            utils.Helper.addToProcessEnvVars(envVars, 'TE.RerunFailedTests', "true");
            tl.debug("Type of rerun: " + this.dtaTestConfig.rerunType);
            if (this.dtaTestConfig.rerunType === 'basedOnTestFailureCount') {
                utils.Helper.addToProcessEnvVars(envVars, 'TE.RerunFailedTestCasesMaxLimit', this.dtaTestConfig.rerunFailedTestCasesMaxLimit.toString());
            } else {
                utils.Helper.addToProcessEnvVars(envVars, 'TE.RerunFailedThreshold', this.dtaTestConfig.rerunFailedThreshold.toString());
            }
            utils.Helper.addToProcessEnvVars(envVars, 'TE.RerunMaxAttempts', this.dtaTestConfig.rerunMaxAttempts.toString());
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