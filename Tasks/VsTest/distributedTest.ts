import * as tl from 'vsts-task-lib/task';
import * as webapim from './node_modules/vso-node-api/WebApi';
import * as testInterfaces from './node_modules/vso-node-api/interfaces/TestInterfaces';
import * as testApis from './node_modules/vso-node-api/TestApi';
import * as fs from 'fs';
import * as path from 'path';
import * as tr from 'vsts-task-lib/toolrunner';
import * as models from './models';
import * as Q from 'q';
import * as ps from 'child_process';

export class DistributedTest {

    constructor(dtaTestConfig: models.dtaTestConfigurations) {
        this.dtaPid = -1;
        this.dtaTestConfig = dtaTestConfig;
        this.tfsCollectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
        this.patToken = tl.getEndpointAuthorization('SystemVssConnection', true).parameters['AccessToken'];
        const releaseId = tl.getVariable('Release.ReleaseId');
        const phaseId = tl.getVariable('Release.DeployPhaseId');
        const projectName = tl.getVariable('System.TeamProject');
        const taskInstanceId = this.getDtaInstanceId();
        this.environmentUri = 'dta://env/' + projectName + '/_apis/release/' + releaseId + '/' + phaseId + '/' + taskInstanceId;
        this.testAgentName = tl.getVariable('Agent.MachineName');
    }

    public runDistributedTest() {
        this.registerAndConfigureAgent();
    }

    private registerAndConfigureAgent() {
        const webapi = this.getWebApi();
        const testApi = webapi.getTestApi();
        const envUrlRef: any = { Url: this.environmentUri };
        const machineNameRef = { Name: this.testAgentName };
        const testAgent =
            {
                Name: this.testAgentName,
                Capabilities: [],
                DtlEnvironment: envUrlRef,
                DtlMachine: machineNameRef
            };

        tl.debug('Configure the Agent with DTA... Invoking the createAgent REST API');
        this.createAgent(testApi, testAgent, 3).then(() => {
            try {
                // TODO: ranjanar: fixasap : This dangerous - Note that the PID only uniquely identifies your child process as long as
                // it is running. After it has exited, the PID might have been reused for a different process.
                process.kill(this.dtaPid);
            } catch (error) {
                tl.debug('Process kill failed, pid: ' + this.dtaPid + ' , error :' + error);
            }
            this.dumpDtaLogFile();
            tl.setResult(tl.TaskResult.Succeeded, 'Task succeeded');
        }, (error) => {
            tl.setResult(tl.TaskResult.Failed, 'Task failed');
        });
    }

    private createAgent(testApi: any, testAgent: any, retries: number): Q.Promise<any> {
        return testApi.createAgent(testAgent)
            .then((registeredAgent) => {
                tl.debug('created the test agent entry in DTA service, id : ' + registeredAgent.id);
                this.dtaPid = this.startDtaExecutionHost(registeredAgent.id);
                return this.startDtaTestRun();
            }, (error) => {
                if (retries > 0) {
                    retries--;
                    tl.error('Error : created the test agent entry in DTA service, so retrying => retries pending  : ' + retries);
                    return this.createAgent(testApi, testAgent, retries);
                }
                return Q.reject('Create Agent REST API failed');
            });
    }

    private startDtaExecutionHost(agentId: any): number {
        this.deleteDtaLogFile();
        const envVars: { [key: string]: string; } = process.env;
        this.addToProcessEnvVars(envVars, 'DTA.AccessToken', this.patToken);
        this.addToProcessEnvVars(envVars, 'DTA.AgentId', agentId);
        this.addToProcessEnvVars(envVars, 'DTA.EnvironmentUri', this.environmentUri);
        this.addToProcessEnvVars(envVars, 'DTA.TeamFoundationCollectionUri', this.tfsCollectionUrl);
        if (this.dtaTestConfig.vsTestVersion.toLowerCase() === 'latest') {
            this.dtaTestConfig.vsTestVersion = '15.0';
        }
        this.addToProcessEnvVars(envVars, 'DTA.TestPlatformVersion', this.dtaTestConfig.vsTestVersion);

        const proc = ps.spawn(this.getDTAExecutionHostLocation(), [], { env: envVars, stdio: 'ignore' });
        tl.debug('DtaExecutionHost is executing with the process : ' + proc.pid);
        return proc.pid;
    }

    private startDtaTestRun(): Q.Promise<any> {
        const runDistributesTestTool = tl.tool(path.join(__dirname, 'modules/TestExecutionHost.exe'));
        const envVars: { [key: string]: string; } = process.env;
        this.addToProcessEnvVars(envVars, 'accesstoken', this.patToken);
        this.addToProcessEnvVars(envVars, 'environmenturi', this.environmentUri);

        // TODO : ranjanar : This is a workaround till we figure out the minimatch pattern
        if (!this.isNullOrUndefined(this.dtaTestConfig.sourceFilter)) {
            this.addToProcessEnvVars(envVars, 'sourcefilter', this.dtaTestConfig.sourceFilter.join(';'));
        } else {
            this.addToProcessEnvVars(envVars, 'sourcefilter', '*.*dll');
        }

        this.addToProcessEnvVars(envVars, 'testcasefilter', this.dtaTestConfig.testcaseFilter);
        this.addToProcessEnvVars(envVars, 'runsettings', this.dtaTestConfig.runSettingsFile);
        this.addToProcessEnvVars(envVars, 'testdroplocation', this.dtaTestConfig.testDropLocation);
        this.addToProcessEnvVars(envVars, 'testrunparams', this.dtaTestConfig.overrideTestrunParameters);
        this.setEnvironmentVariableToString(envVars, 'codecoverageenabled', this.dtaTestConfig.codeCoverageEnabled);
        this.addToProcessEnvVars(envVars, 'buildconfig', this.dtaTestConfig.buildConfig);
        this.addToProcessEnvVars(envVars, 'buildplatform', this.dtaTestConfig.buildPlatform);
        this.addToProcessEnvVars(envVars, 'testconfigurationmapping', this.dtaTestConfig.testConfigurationMapping);
        this.addToProcessEnvVars(envVars, 'testruntitle', this.dtaTestConfig.testRunTitle);
        this.addToProcessEnvVars(envVars, 'testselection', this.dtaTestConfig.testSelection);
        this.setEnvironmentVariableToString(envVars, 'testplan', this.dtaTestConfig.testplan);
        if (!this.isNullOrUndefined(this.dtaTestConfig.testSuites)) {
            this.addToProcessEnvVars(envVars, 'testsuites', this.dtaTestConfig.testSuites.join(','));
        }
        this.setEnvironmentVariableToString(envVars, 'testplanconfigid', this.dtaTestConfig.testPlanConfigId);
        this.setEnvironmentVariableToString(envVars, 'customslicingenabled', this.dtaTestConfig.customSlicingenabled);

        return runDistributesTestTool.exec(<tr.IExecOptions>{ cwd: path.join(__dirname, 'modules'), env: envVars })
            .then(() => {
                tl.debug('Run Distributed Test finished');
                return Q.resolve(true);
            }, (error) => {
                tl.debug('Run Distributed Test failed' + error);
                return Q.reject(false);
            });
    }

    private deleteDtaLogFile() {
        const logPath = path.join(__dirname, 'modules/DTAExecutionHost.exe.log');
        tl.rmRF(logPath, true);
    }

    private dumpDtaLogFile() {
        const logPath = path.join(__dirname, 'modules/DTAExecutionHost.exe.log');
        tl.debug(fs.readFileSync(logPath, 'utf-8'));
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

    private getWebApi(): any {
        return new webapim.WebApi(this.tfsCollectionUrl, webapim.getBearerHandler(this.patToken));
    }

    private getDTAExecutionHostLocation(): string {
        return path.join(__dirname, 'modules/DTAExecutionHost.exe');
    }

    private dtaTestConfig: models.dtaTestConfigurations;
    private environmentUri: string;
    private tfsCollectionUrl: string;
    private patToken: string;
    private testAgentName: string;
    private dtaPid: number;
}