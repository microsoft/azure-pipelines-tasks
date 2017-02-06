import * as fs from 'fs';
import * as path from 'path';
import * as Q from 'q';
import * as ps from 'child_process';
import * as tl from 'vsts-task-lib/task';
import * as webapim from 'vso-node-api/WebApi';
import * as testapim from 'vso-node-api/TestApi';
import * as testInterfaces from 'vso-node-api/interfaces/TestInterfaces'
import * as tr from 'vsts-task-lib/toolrunner';
import * as models from './models';
import * as settingsHelper from './settingsHelper';

export class DistributedTest {
    constructor(dtaTestConfig: models.DtaTestConfigurations) {
        this.dtaPid = -1;
        this.dtaTestConfig = dtaTestConfig;
        this.tfsCollectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
        // tslint:disable-next-line:no-string-literal
        this.patToken = tl.getEndpointAuthorization('SystemVssConnection', true).parameters['AccessToken'];
        const releaseId = tl.getVariable('Release.ReleaseId');
        const phaseId = tl.getVariable('Release.DeployPhaseId');
        const projectName = tl.getVariable('System.TeamProject');
        const taskInstanceId = this.getDtaInstanceId();
        this.environmentUri = 'dta://env/' + projectName + '/_apis/release/' + releaseId + '/' + phaseId + '/' + taskInstanceId;
        this.testAgentName = tl.getVariable('Agent.MachineName');
        this.dtaHostLogFilePath = path.join(tl.getVariable('System.DefaultWorkingDirectory'), 'DTAExecutionHost.exe.log');
    }

    public runDistributedTest() {
        this.registerAndConfigureAgent();
    }

   private async registerAndConfigureAgent() {
        tl.debug('Configure the Agent with DTA... Invoking the createAgent REST API');

        try {
            const agentId = await this.createAgent(3);
            this.dtaPid = this.startDtaExecutionHost(agentId);
            await this.startDtaTestRun();
            try {
                // TODO: ranjanar: fixasap : This dangerous - Note that the PID only uniquely identifies your child process 
                // as long as it is running. After it has exited, the PID might have been reused for a different process.
                process.kill(this.dtaPid);
            } catch (error) {
                tl.debug('Process kill failed, pid: ' + this.dtaPid + ' , error :' + error);
            }
            tl.debug(fs.readFileSync(this.dtaHostLogFilePath, 'utf-8'));
            tl.setResult(tl.TaskResult.Succeeded, 'Task succeeded');
        } catch (error) {
            tl.debug('Create Agent failed with  : ' + error);
            tl.setResult(tl.TaskResult.Failed, 'Task failed');
        }
    }

    private async createAgent(retries: number) {
        while(retries > 0) {
            retries--;
            try {
                const envUrlRef: any = { Url: this.environmentUri };
                const machineNameRef = { Name: this.testAgentName };
                // TODO : Change any to appropriate types once promiseme package is avialable
                const testAgent: any = {
                                    Name: this.testAgentName,
                                    Capabilities: [],
                                    DtlEnvironment: envUrlRef,
                                    DtlMachine: machineNameRef };
                const webapi: any = new webapim.WebApi(this.tfsCollectionUrl, webapim.getBearerHandler(this.patToken));
                const testApi: any = webapi.getTestApi();
                const registeredAgent = await testApi.createAgent(testAgent);
                tl.debug('created the test agent entry in DTA service, id : ' + registeredAgent.id);
                return registeredAgent.id;
            } catch (error) {
                tl.error('Error : created the test agent entry in DTA service, so retrying => retries pending  : ' + retries);
                if(retries === 0) {
                    throw error;
                }
            }
        }
    }

    private startDtaExecutionHost(agentId: any): number {
        tl.rmRF(this.dtaHostLogFilePath, true);
        const envVars: { [key: string]: string; } = process.env;
        this.addToProcessEnvVars(envVars, 'DTA.AccessToken', this.patToken);
        this.addToProcessEnvVars(envVars, 'DTA.AgentId', agentId);
        this.addToProcessEnvVars(envVars, 'DTA.EnvironmentUri', this.environmentUri);
        this.addToProcessEnvVars(envVars, 'DTA.TeamFoundationCollectionUri', this.tfsCollectionUrl);
        this.addToProcessEnvVars(envVars, 'DTA.MiniMatchSourceFilter', 'true');
        if (this.dtaTestConfig.vsTestVersion.toLowerCase() === 'latest') {
            this.dtaTestConfig.vsTestVersion = '15.0';
        }
        this.addToProcessEnvVars(envVars, 'DTA.TestPlatformVersion', this.dtaTestConfig.vsTestVersion);

        // We are logging everything to a DTAExecutionHost.exe.log file and reading it at the end and adding to the build task debug logs
        // So we are not redirecting the IO streams from the DTAExecutionHost.exe process
        // We are not using toolrunner here because it doesn't have option to ignore the IO stream, so directly using spawn

        // TODO : Currently we dont have way to see if crashes
        const proc = ps.spawn(path.join(__dirname, 'Modules/DTAExecutionHost.exe'), [], { env: envVars, stdio: 'ignore' });
        tl.debug('DtaExecutionHost is executing with the process : ' + proc.pid);
        return proc.pid;
    }

    private async startDtaTestRun() {
        const runDistributesTestTool = tl.tool(path.join(__dirname, 'modules/TestExecutionHost.exe'));
        const envVars: { [key: string]: string; } = process.env;
        this.addToProcessEnvVars(envVars, 'accesstoken', this.patToken);
        this.addToProcessEnvVars(envVars, 'environmenturi', this.environmentUri);

        if (!this.isNullOrUndefined(this.dtaTestConfig.sourceFilter)) {
            this.addToProcessEnvVars(envVars, 'sourcefilter', this.dtaTestConfig.sourceFilter.join('|'));
        } else {
            // TODO : Is this fine? Or we will go for all files and remove this negation as well?
            this.addToProcessEnvVars(envVars, 'sourcefilter', '!**\obj\**');
        }

        //Modify settings file to enable configurations and data collectors.
        var settingsFile = this.dtaTestConfig.runSettingsFile;
        try {
            settingsFile = await settingsHelper.updateSettingsFileAsRequired(this.dtaTestConfig.runSettingsFile, this.dtaTestConfig.runInParallel, this.dtaTestConfig.videoCoverageEnabled, this.dtaTestConfig.tiaConfig, true);
        } catch (error) {
            tl.warning(tl.loc('ErrorWhileUpdatingSettings'));
            tl.debug(error);
        }
        
        this.addToProcessEnvVars(envVars, 'testcasefilter', this.dtaTestConfig.testcaseFilter);
        this.addToProcessEnvVars(envVars, 'runsettings', settingsFile);
        this.addToProcessEnvVars(envVars, 'testdroplocation', this.dtaTestConfig.testDropLocation);
        this.addToProcessEnvVars(envVars, 'testrunparams', this.dtaTestConfig.overrideTestrunParameters);
        this.setEnvironmentVariableToString(envVars, 'codecoverageenabled', this.dtaTestConfig.codeCoverageEnabled);
        this.addToProcessEnvVars(envVars, 'buildconfig', this.dtaTestConfig.buildConfig);
        this.addToProcessEnvVars(envVars, 'buildplatform', this.dtaTestConfig.buildPlatform);
        this.addToProcessEnvVars(envVars, 'testconfigurationmapping', this.dtaTestConfig.testConfigurationMapping);
        this.addToProcessEnvVars(envVars, 'testruntitle', this.dtaTestConfig.testRunTitle);
        this.addToProcessEnvVars(envVars, 'testselection', this.dtaTestConfig.testSelection);
        this.addToProcessEnvVars(envVars, 'tcmtestrun', this.dtaTestConfig.onDemandTestRunId);
        this.setEnvironmentVariableToString(envVars, 'testplan', this.dtaTestConfig.testplan);
        if (!this.isNullOrUndefined(this.dtaTestConfig.testSuites)) {
            this.addToProcessEnvVars(envVars, 'testsuites', this.dtaTestConfig.testSuites.join(','));
        }
        this.setEnvironmentVariableToString(envVars, 'testplanconfigid', this.dtaTestConfig.testPlanConfigId);
        // In the phases world we will distribute based on number of agents
        this.setEnvironmentVariableToString(envVars, 'customslicingenabled', 'true');

        if(this.dtaTestConfig.runTestsInIsolation) {
            tl.warning(tl.loc('runTestInIsolationNotSupported'));
        }

        await runDistributesTestTool.exec(<tr.IExecOptions>{ cwd: path.join(__dirname, 'modules'), env: envVars });
        await this.cleanUp(settingsFile);
        tl.debug('Run Distributed Test finished');        
    }

    private addToProcessEnvVars(envVars: { [key: string]: string; }, name: string, value: string) {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value;
        }
    }

    private setEnvironmentVariableToString(envVars: { [key: string]: string; }, name: string, value: any) {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value.toString();
        }
    }

    private isNullEmptyOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }

    private isNullOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }

    private getDtaInstanceId(): number {
        const taskInstanceIdString = tl.getVariable('DTA_INSTANCE_ID');
        let taskInstanceId: number = 1;
        if (taskInstanceIdString) {
            const instanceId: number = Number(taskInstanceIdString);
            if (!isNaN(instanceId)) {
                taskInstanceId = instanceId + 1;
            }
        }
        tl.setVariable('DTA_INSTANCE_ID', taskInstanceId.toString());
        return taskInstanceId;
    }

    private async cleanUp(temporarySettingsFile: string) {
    //cleanup the runsettings file
    if (temporarySettingsFile && this.dtaTestConfig.runSettingsFile != temporarySettingsFile) {
        try {
            tl.rmRF(temporarySettingsFile, true);
        } catch (error) {
            //Ignore.
        }
    }
}

    private dtaHostLogFilePath: string;
    private dtaTestConfig: models.DtaTestConfigurations;
    private environmentUri: string;
    private tfsCollectionUrl: string;
    private patToken: string;
    private testAgentName: string;
    private dtaPid: number;
}