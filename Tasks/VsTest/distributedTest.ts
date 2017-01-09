import tl = require('vsts-task-lib/task');
import webapim = require('./node_modules/vso-node-api/WebApi');
import testInterfaces = require('./node_modules/vso-node-api/interfaces/TestInterfaces');
import testApis = require('./node_modules/vso-node-api/TestApi');
import fs = require('fs');
import path = require('path');
import tr = require('vsts-task-lib/toolrunner');
import models = require('./models')

export class DistributedTest {
    constructor(dtaTestConfig: models.dtaTestConfigurations) {
        this._tfsCollectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
        var auth = tl.getEndpointAuthorization("SystemVssConnection", true);
        this._patToken = auth.parameters["AccessToken"];
        var releaseId = tl.getVariable("Release.ReleaseId");
        var phaseId = tl.getVariable("Release.DeployPhaseId");
        var projectName = tl.getVariable("System.TeamProject");
        var taskInstanceId = this.getDtaInstanceId();
        this._environmentUri = "dta://env/" + projectName + "/_apis/release/" + releaseId + "/" + phaseId + "/" + taskInstanceId;
        this._testAgentName = tl.getVariable("Agent.MachineName");
    }

    public runDistributedTest() {
        this.registerAndConfigureAgent();
    }

    private registerAndConfigureAgent(): string {
        var webapi = this.getWebApi();
        var testApi = webapi.getTestApi();

        tl.debug("Configure the Agent with DTA...");

        var envUrlRef: any = { Url: this._environmentUri };
        var machineNameRef = { Name: this._testAgentName };
        var testAgent =
            {
                Name: this._testAgentName,
                Capabilities: [],
                DtlEnvironment: envUrlRef,
                DtlMachine: machineNameRef
            };

        tl.debug("Invoking the createAgent REST API");
        this.createAgent(testApi, testAgent, 3);
        
        return this._environmentUri;
    }

    private createAgent(testApi: any, testAgent: any, retries: number)
    {
        return testApi.createAgent(testAgent)
        .then((registeredAgent) => {
            this.startDtaExecutionHost(registeredAgent.id);
            this.startDtaTestRun();
        }, (error) => {
            if (retries > 0)
            {
                retries--;
                tl.error("Error : created the test agent entry in DTA service, so retrying => retries pending  : " + retries);
                return this.createAgent(testApi, testAgent, retries);
            }                    
        });
    }

    private startDtaExecutionHost(agentId: any) {
        tl.debug("created the test agent entry in DTA service, id : " + agentId);

        // TODO : Check for run UI tests?
        var dtaExecutionHostTool = tl.tool(this.getDTAExecutionHostLocation());

        var envVars: { [key: string]: string; } = process.env;
        this.setEnvironmentVariable(envVars, "DTA.AccessToken", this._patToken);
        this.setEnvironmentVariable(envVars, "DTA.AgentId", agentId);
        this.setEnvironmentVariable(envVars, "DTA.EnvironmentUri", this._environmentUri);
        this.setEnvironmentVariable(envVars, "DTA.TeamFoundationCollectionUri", this._tfsCollectionUrl);
        this.setEnvironmentVariable(envVars, "DTA.TestPlatformVersion", "15.0"); // TODO : Add support for other versions?        

        var execResult = dtaExecutionHostTool.exec(<tr.IExecOptions>{ cwd: path.join(__dirname, "modules"), env: envVars })
            .then(() => {
                tl.debug("dta Execution Host finished");
            })
            .fail((error) => {
                tl.error("dta Execution Host failed" + error);
            });
    }

    private startDtaTestRun() {
        var runDistributesTestTool = tl.tool(path.join(__dirname, "modules/TestExecutionHost.exe"));
        var envVars: { [key: string]: string; } = process.env;
        this.setEnvironmentVariable(envVars, "accesstoken", this._patToken);
        this.setEnvironmentVariable(envVars, "environmenturi", this._environmentUri);

        // TODO : ranjanar : This is a workaround till we figure out the minimatch pattern
        if (!this.isNullOrUndefined(this._dtaTestConfig.sourceFilter)) {
            this.setEnvironmentVariable(envVars, "sourcefilter", this._dtaTestConfig.testSuites.join(";"));
        }
        else {
            this.setEnvironmentVariable(envVars, "sourcefilter", "*.*dll");
        }

        this.setEnvironmentVariable(envVars, "testcasefilter", this._dtaTestConfig.testcaseFilter);
        this.setEnvironmentVariable(envVars, "runsettings", this._dtaTestConfig.runSettingsFile);
        this.setEnvironmentVariable(envVars, "testdroplocation", this._dtaTestConfig.testDropLocation);
        this.setEnvironmentVariable(envVars, "testrunparams", this._dtaTestConfig.overrideTestrunParameters);
        this.setEnvironmentVariableToString(envVars, "codecoverageenabled", this._dtaTestConfig.codeCoverageEnabled);
        this.setEnvironmentVariable(envVars, "buildconfig", this._dtaTestConfig.buildConfig);
        this.setEnvironmentVariable(envVars, "buildplatform", this._dtaTestConfig.buildPlatform);
        this.setEnvironmentVariable(envVars, "testconfigurationmapping", this._dtaTestConfig.testConfigurationMapping);
        this.setEnvironmentVariable(envVars, "testruntitle", this._dtaTestConfig.testRunTitle);
        this.setEnvironmentVariable(envVars, "testselection", this._dtaTestConfig.testSelection);
        this.setEnvironmentVariableToString(envVars, "testplan", this._dtaTestConfig.testplan);
        if (!this.isNullOrUndefined(this._dtaTestConfig.testSuites)) {
            this.setEnvironmentVariable(envVars, "testsuites", this._dtaTestConfig.testSuites.join(","));
        }
        this.setEnvironmentVariableToString(envVars, "testplanconfigid", this._dtaTestConfig.testPlanConfigId);
        this.setEnvironmentVariableToString(envVars, "customslicingenabled", this._dtaTestConfig.customSlicingenabled);

        var execResult = runDistributesTestTool.exec(<tr.IExecOptions>{ cwd: path.join(__dirname, "modules"), env: envVars })
            .then(() => {
                tl.debug("Run Distributed Test finished");
            })
            .fail((error) => {
                tl.debug("Run Distributed Test failed" + error);
            });
    }

    private setEnvironmentVariable(envVars: { [key: string]: string; }, name: string, value: string) {
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
        return obj === null || obj === "" || obj === undefined;
    }

    private isNullOrUndefined(obj) {
        return obj === null || obj === "" || obj === undefined;
    }

    private getDtaInstanceId(): number {
        var taskInstanceIdString = tl.getVariable("DTA_INSTANCE_ID");
        var taskInstanceId: number = 1;
        if (taskInstanceIdString) {
            var instanceId: number = Number(taskInstanceIdString);
            if (!isNaN(instanceId)) {
                taskInstanceId = instanceId + 1;
            }
        }
        tl.setVariable("DTA_INSTANCE_ID", taskInstanceId.toString());
        return taskInstanceId;
    }

    private getWebApi(): any {
        return new webapim.WebApi(this._tfsCollectionUrl, webapim.getBearerHandler(this._patToken));
    }

    private getDTAExecutionHostLocation(): string {
        return path.join(__dirname, "modules/DTAExecutionHost.exe");
    }

    private _dtaTestConfig: models.dtaTestConfigurations;
    private _environmentUri: string;
    private _tfsCollectionUrl: string;
    private _patToken: string;
    private _testAgentName: string;
}