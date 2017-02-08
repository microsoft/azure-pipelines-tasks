import * as fs from 'fs';
import * as path from 'path';
import * as Q from 'q';
import * as ps from 'child_process';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as models from './models';
import * as settingsHelper from './settingsHelper';
import * as utils from './helpers';
import * as ta from './testAgent';
import versionFinder = require('./versionFinder')

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
            this.dtaPid = this.startDtaExecutionHost(agentId);
            await this.startDtaTestRun();
            try {
                // TODO: ranjanar: fixasap : This dangerous - Note that the PID only uniquely identifies your child process 
                // as long as it is running. After it has exited, the PID might have been reused for a different process.
                process.kill(this.dtaPid);
            } catch (error) {
                tl.debug('Process kill failed, pid: ' + this.dtaPid + ' , error :' + error);
            }
            tl.debug(fs.readFileSync(this.dtaTestConfig.dtaEnvironment.dtaHostLogFilePath, 'utf-8'));
            tl.setResult(tl.TaskResult.Succeeded, 'Task succeeded');
        } catch (error) {
            tl.debug('Create Agent failed with  : ' + error);
            tl.setResult(tl.TaskResult.Failed, 'Task failed');
        }
    }

    private startDtaExecutionHost(agentId: any): number {
        tl.rmRF(this.dtaTestConfig.dtaEnvironment.dtaHostLogFilePath, true);
        const envVars: { [key: string]: string; } = process.env;
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', this.dtaTestConfig.dtaEnvironment.patToken);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AgentId', agentId);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.EnvironmentUri', this.dtaTestConfig.dtaEnvironment.environmentUri);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TeamFoundationCollectionUri', this.dtaTestConfig.dtaEnvironment.tfsCollectionUrl);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.MiniMatchSourceFilter', 'true');
        if (this.dtaTestConfig.vsTestVersion.toLowerCase() === 'latest') {
            this.dtaTestConfig.vsTestVersion = '15.0';
        }
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TestPlatformVersion', this.dtaTestConfig.vsTestVersion);
        versionFinder.locateTestWindow(this.dtaTestConfig)  
        .then (function (exeInfo) {
        
        tl.debug("Adding env var DTA.TestWindow.Path = " + exeInfo.location);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TestWindow.Path', exeInfo.location);            

        // We are logging everything to a DTAExecutionHost.exe.log file and reading it at the end and adding to the build task debug logs
        // So we are not redirecting the IO streams from the DTAExecutionHost.exe process
        // We are not using toolrunner here because it doesn't have option to ignore the IO stream, so directly using spawn

        // TODO : Currently we dont have way to see if crashes
        const proc = ps.spawn(path.join(__dirname, 'Modules/DTAExecutionHost.exe'), [], { env: envVars, stdio: 'ignore' });
        tl.debug('DtaExecutionHost is executing with the process : ' + proc.pid);
        return proc.pid;
        });
        tl.error(tl.loc('VstestNotFound'));
        return 0;
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
        var settingsFile = this.dtaTestConfig.settingsFile;
        try {
            settingsFile = await settingsHelper.updateSettingsFileAsRequired(this.dtaTestConfig.settingsFile, this.dtaTestConfig.runInParallel, this.dtaTestConfig.tiaConfig, null, false);
        } catch (error) {
            tl.warning(tl.loc('ErrorWhileUpdatingSettings'));
            tl.debug(error);
        }
        
        utils.Helper.addToProcessEnvVars(envVars, 'testcasefilter', this.dtaTestConfig.testcaseFilter);
        utils.Helper.addToProcessEnvVars(envVars, 'runsettings', settingsFile);
        utils.Helper.addToProcessEnvVars(envVars, 'testdroplocation', this.dtaTestConfig.testDropLocation);
        utils.Helper.addToProcessEnvVars(envVars, 'testrunparams', this.dtaTestConfig.overrideTestrunParameters);
        utils.Helper.setEnvironmentVariableToString(envVars, 'codecoverageenabled', this.dtaTestConfig.codeCoverageEnabled);
        utils.Helper.addToProcessEnvVars(envVars, 'buildconfig', this.dtaTestConfig.buildConfig);
        utils.Helper.addToProcessEnvVars(envVars, 'buildplatform', this.dtaTestConfig.buildPlatform);
        utils.Helper.addToProcessEnvVars(envVars, 'testconfigurationmapping', this.dtaTestConfig.testConfigurationMapping);
        utils.Helper.addToProcessEnvVars(envVars, 'testruntitle', this.dtaTestConfig.testRunTitle);
        utils.Helper.addToProcessEnvVars(envVars, 'testselection', this.dtaTestConfig.testSelection);
        utils.Helper.addToProcessEnvVars(envVars, 'tcmtestrun', this.dtaTestConfig.onDemandTestRunId);
        utils.Helper.setEnvironmentVariableToString(envVars, 'testplan', this.dtaTestConfig.testplan);
        if (!utils.Helper.isNullOrUndefined(this.dtaTestConfig.testSuites)) {
            utils.Helper.addToProcessEnvVars(envVars, 'testsuites', this.dtaTestConfig.testSuites.join(','));
        }
        utils.Helper.setEnvironmentVariableToString(envVars, 'testplanconfigid', this.dtaTestConfig.testPlanConfigId);
        // In the phases world we will distribute based on number of agents
        utils.Helper.setEnvironmentVariableToString(envVars, 'customslicingenabled', 'true');

        await runDistributesTestTool.exec(<tr.IExecOptions>{ cwd: path.join(__dirname, 'modules'), env: envVars });
        await this.cleanUp(settingsFile);
        tl.debug('Run Distributed Test finished');        
    }

    private async cleanUp(temporarySettingsFile: string) {
    //cleanup the runsettings file
    if (temporarySettingsFile && this.dtaTestConfig.settingsFile != temporarySettingsFile) {
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