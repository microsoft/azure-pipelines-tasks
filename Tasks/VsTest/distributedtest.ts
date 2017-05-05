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

export class DistributedTest {
    constructor(dtaTestConfig: models.DtaTestConfigurations) {
        this.dtaPid = -1;
        this.dtaTestConfig = dtaTestConfig;
    }

    public runDistributedTest() {
        this.registerAndConfigureAgent();
    }

    private async registerAndConfigureAgent() {
        tl.debug('Configure the Agent with DTA... Invoking the createAgent REST API');

        try {
            const agentId = await ta.TestAgent.createAgent(this.dtaTestConfig.dtaEnvironment, 3);
            await this.startDtaExecutionHost(agentId);
            await this.startDtaTestRun();
            try {
                if (this.dtaPid !== -1) {
                    tl.debug('Trying to kill the Modules/DTAExecutionHost.exe process with pid :' + this.dtaPid);
                    process.kill(this.dtaPid);
                }
            } catch (error) {
                tl.warning('Modules/DTAExecutionHost.exe process kill failed, pid: ' + this.dtaPid + ' , error :' + error);
            }
            tl.setResult(tl.TaskResult.Succeeded, 'Task succeeded');
        } catch (error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, error);
        }
    }

    private async startDtaExecutionHost(agentId: any) {
        const envVars: { [key: string]: string; } = process.env;
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', this.dtaTestConfig.dtaEnvironment.patToken);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AgentId', agentId);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AgentName', this.dtaTestConfig.dtaEnvironment.agentName);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.EnvironmentUri', this.dtaTestConfig.dtaEnvironment.environmentUri);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TeamFoundationCollectionUri', this.dtaTestConfig.dtaEnvironment.tfsCollectionUrl);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.MiniMatchSourceFilter', 'true');
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.LocalTestDropPath', this.dtaTestConfig.testDropLocation);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.EnableConsoleLogs', 'true');
        if (this.dtaTestConfig.pathtoCustomTestAdapters) {
            const testAdapters = tl.findMatch(this.dtaTestConfig.pathtoCustomTestAdapters , '**\\*TestAdapter.dll' );
            if (!testAdapters || (testAdapters && testAdapters.length === 0)) {
                tl.warning(tl.loc('pathToCustomAdaptersContainsNoAdapters', this.dtaTestConfig.pathtoCustomTestAdapters))
            }
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.CustomTestAdapters', this.dtaTestConfig.pathtoCustomTestAdapters);
        }

        // If we are setting the path version is not needed
        const exelocation = path.dirname(this.dtaTestConfig.vsTestVersionDetais.vstestExeLocation);
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

        // We are logging everything to a DTAExecutionHost.exe.log file and reading it at the end and adding to the build task debug logs
        // So we are not redirecting the IO streams from the DTAExecutionHost.exe process
        // We are not using toolrunner here because it doesn't have option to ignore the IO stream, so directly using spawn

        const proc = ps.spawn(path.join(__dirname, 'Modules/DTAExecutionHost.exe'), [], { env: envVars });
        this.dtaPid = proc.pid;
        tl.debug('Modules/DTAExecutionHost.exe is executing with the process id : ' + this.dtaPid);

        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');
        proc.stdout.on('data', (c) => {
            // this is bit hacky way to fix the web method logging as it's not configurable currently
            // and writes info to stdout directly
            const lines = c.toString().split('\n');
            lines.forEach(function (line: string) {
                if (line.startsWith('Web method')) {
                    tl._outStream.write('##vso[task.debug]' + line);
                } else {
                    tl._outStream.write(line);
                }
            });
        });

        proc.stderr.on('data', (c) => {
            const lines = c.toString().split('\n');
            lines.forEach(function (line: string) {
                tl._errStream.write(line);
            });
        });

        proc.on('error', (err) => {
            this.dtaPid = -1;
            throw new Error('Failed to start Modules/DTAExecutionHost.exe.');
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                tl.debug('Modules/DTAExecutionHost.exe process exited with code ' + code);
            } else {
                tl.debug('Modules/DTAExecutionHost.exe exited');
            }
            this.dtaPid = -1;
        });
    }

    private async startDtaTestRun() {
        const runDistributesTestTool = tl.tool(path.join(__dirname, 'modules/TestExecutionHost.exe'));
        const envVars: { [key: string]: string; } = process.env;
        utils.Helper.addToProcessEnvVars(envVars, 'accesstoken', this.dtaTestConfig.dtaEnvironment.patToken);
        utils.Helper.addToProcessEnvVars(envVars, 'environmenturi', this.dtaTestConfig.dtaEnvironment.environmentUri);

        if (!utils.Helper.isNullOrUndefined(this.dtaTestConfig.sourceFilter)) {
            utils.Helper.addToProcessEnvVars(envVars, 'sourcefilter', this.dtaTestConfig.sourceFilter.join('|'));
        } else {
            // TODO : Is this fine? Or we will go for all files and remove this negation as well?
            utils.Helper.addToProcessEnvVars(envVars, 'sourcefilter', '!**\obj\**');
        }

        //Modify settings file to enable configurations and data collectors.
        let settingsFile = this.dtaTestConfig.settingsFile;
        try {
            settingsFile = await settingsHelper.updateSettingsFileAsRequired
                (this.dtaTestConfig.settingsFile, this.dtaTestConfig.runInParallel, this.dtaTestConfig.tiaConfig,
                null, false, this.dtaTestConfig.overrideTestrunParameters);
            //Reset override option so that it becomes a no-op in TaskExecutionHost
            this.dtaTestConfig.overrideTestrunParameters = null;
        } catch (error) {
            tl.warning(tl.loc('ErrorWhileUpdatingSettings'));
            tl.debug(error);
        }

        utils.Helper.addToProcessEnvVars(envVars, 'testcasefilter', this.dtaTestConfig.testcaseFilter);
        utils.Helper.addToProcessEnvVars(envVars, 'runsettings', settingsFile);
        utils.Helper.addToProcessEnvVars(envVars, 'testdroplocation', this.dtaTestConfig.testDropLocation);
        utils.Helper.addToProcessEnvVars(envVars, 'testrunparams', this.dtaTestConfig.overrideTestrunParameters);
        utils.Helper.addToProcessEnvVars(envVars, 'buildconfig', this.dtaTestConfig.buildConfig);
        utils.Helper.addToProcessEnvVars(envVars, 'buildplatform', this.dtaTestConfig.buildPlatform);
        utils.Helper.addToProcessEnvVars(envVars, 'testconfigurationmapping', this.dtaTestConfig.testConfigurationMapping);
        utils.Helper.addToProcessEnvVars(envVars, 'testruntitle', this.dtaTestConfig.testRunTitle);
        utils.Helper.addToProcessEnvVars(envVars, 'testselection', this.dtaTestConfig.testSelection);
        utils.Helper.addToProcessEnvVars(envVars, 'tcmtestrun', this.dtaTestConfig.onDemandTestRunId);
        if (!utils.Helper.isNullOrUndefined(this.dtaTestConfig.testSuites)) {
            utils.Helper.addToProcessEnvVars(envVars, 'testsuites', this.dtaTestConfig.testSuites.join(','));
        }
        utils.Helper.setEnvironmentVariableToString(envVars, 'codecoverageenabled', this.dtaTestConfig.codeCoverageEnabled);
        utils.Helper.setEnvironmentVariableToString(envVars, 'testplan', this.dtaTestConfig.testplan);
        utils.Helper.setEnvironmentVariableToString(envVars, 'testplanconfigid', this.dtaTestConfig.testPlanConfigId);
        // In the phases world we will distribute based on number of agents
        utils.Helper.setEnvironmentVariableToString(envVars, 'customslicingenabled', 'true');
        utils.Helper.setEnvironmentVariableToString(envVars, 'maxagentphaseslicing', this.dtaTestConfig.numberOfAgentsInPhase.toString());

        await runDistributesTestTool.exec(<tr.IExecOptions>{ cwd: path.join(__dirname, 'modules'), env: envVars });
        await this.cleanUp(settingsFile);
        tl.debug('Run Distributed Test finished');
    }

    private async cleanUp(temporarySettingsFile: string) {
        //cleanup the runsettings file
        if (temporarySettingsFile && this.dtaTestConfig.settingsFile !== temporarySettingsFile) {
            try {
                tl.rmRF(temporarySettingsFile, true);
            } catch (error) {
                //Ignore.
            }
        }
    }
    private dtaTestConfig: models.DtaTestConfigurations;
    private dtaPid: number;
}