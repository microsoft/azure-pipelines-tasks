import msRestAzure = require('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common');
import webClient = require("azure-pipelines-tasks-azure-arm-rest-v2/webClient");
import { ApiResult, ApiCallback, ToError } from "azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClientBase";
import { ServiceClient } from "azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClient"
import tl = require("azure-pipelines-task-lib/task");
import * as yaml from "js-yaml";
import * as AcrTaskRequest from "../models/acrtaskrequestbody";
import { TaskUtil } from "../utilities/utils";
import { AcrTask } from "../models/acrtaskparameters";
import * as semver from 'semver';
import { tinyGuid } from 'utility-common-v2/tinyGuidUtility'

const acrTaskbaseUri: string = "//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.ContainerRegistry/registries/{registryName}";
const dummyContextUrl: string = tl.getVariable('system.TeamFoundationCollectionUri');

export class AcrTaskClient extends ServiceClient {
    public createTask: boolean = false;
    public updateTask: boolean = false;
    public acrTask: AcrTask;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials,
        subscriptionId: string, acrTask: AcrTask) {

        super(credentials, subscriptionId);

        this.acrTask = acrTask;
        this.apiVersion = '2019-06-01-preview';
    }

    public async getBuildSourceUploadUrl(callback?: ApiCallback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs();

        var requestUri = this.getRequestUri(
            `${acrTaskbaseUri}/listBuildSourceUploadUrl`,
            {
                '{resourceGroupName}': resourceGroupName,
                '{registryName}': acrRegName,
            });
        const requestMethod = "POST";
        var httpRequest = this._createHttpRequest(requestMethod, requestUri);
        console.log(tl.loc("FetchUploadBlobSourceUrl"));

        this.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode === 200) {
                // Generate Response
                console.log(tl.loc("FetchUploadBlobSourceUrl"));
                return new ApiResult(null, response.body);
            }
            else {
                // Generate exception
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public async getTask(callback?: ApiCallback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let acrTaskName = this.acrTask.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs();

        var requestUri = this.getRequestUri(
            `${acrTaskbaseUri}/tasks/{taskName}`,
            {
                '{resourceGroupName}': resourceGroupName,
                '{registryName}': acrRegName,
                '{taskName}': acrTaskName
            });
        const requestMethod = "GET";
        var httpRequest = this._createHttpRequest(requestMethod, requestUri);
        console.log(tl.loc("FetchAcrTask", acrTaskName));

        this.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode === 200) {
                // Generate Response
                this.updateTask = true;
                console.log(tl.loc("UpdateAcrTask", this.acrTask.name));
                return new ApiResult(null, response.body);
            }
            else if (statusCode === 404) {
                this.createTask = true;
                console.log(tl.loc("CreateAcrTask", this.acrTask.name, this.acrTask.name));
                return new ApiResult(null);
            }
            else {
                // Generate exception
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public async createOrUpdateTask(callback?: ApiCallback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let acrTaskName = this.acrTask.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs();

        var requestUri = this.getRequestUri(
            `${acrTaskbaseUri}/tasks/{taskName}`,
            {
                '{resourceGroupName}': resourceGroupName,
                '{registryName}': acrRegName,
                '{taskName}': acrTaskName
            });

        var requestMethod = "PUT";
        if (this.updateTask) {
            requestMethod = 'PATCH';
        }

        var httpRequest = this._createHttpRequest(requestMethod, requestUri);
        let requestBody: AcrTaskRequest.IAcrTaskRequestBody = this._getRequestBodyForAddOrUpdateTask();
        tl.debug(JSON.stringify(requestBody));
        httpRequest.body = JSON.stringify(requestBody);

        this.beginRequest(httpRequest).then(async (response) => {
            var statusCode = response.statusCode;
            if (statusCode === 200) {
                // Generate Response
                if (this.createTask) {
                    console.log(tl.loc("CreatedAcrTask", this.acrTask.name));
                }
                else {
                    console.log(tl.loc("UpdatedAcrTask", this.acrTask.name));
                }

                return new ApiResult(null, response);
            }
            else {
                // Generate exception
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public runTask(taskId: string, callback?: ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let acrTaskName = this.acrTask.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs();

        const requestMethod = "POST";
        var requestUri = this.getRequestUri(
            `${acrTaskbaseUri}/scheduleRun`,
            {
                '{resourceGroupName}': resourceGroupName,
                '{registryName}': acrRegName
            });

        var httpRequest = this._createHttpRequest(requestMethod, requestUri);
        let requestbody = {
            "type": "TaskRunRequest",
            taskId: taskId,
            taskName: acrTaskName
        } as AcrTaskRequest.ITaskRunRequest;

        if (this.acrTask.contextType == "file") {
            let overrideTaskStepProperties = {} as AcrTaskRequest.IOverrideTaskStepProperties;
            // override contextPath
            overrideTaskStepProperties = {
                arguments: [],
                contextPath: this.acrTask.context
            } as AcrTaskRequest.IOverrideTaskStepProperties;

            if (this.acrTask.taskRequestStepType == AcrTaskRequest.TaskRequestStepType.EncodedTask) {
                var runValues = TaskUtil.getListOfTagValuesForImageNames(this.acrTask);
                overrideTaskStepProperties.values = runValues;
            }

            requestbody.overrideTaskStepProperties = overrideTaskStepProperties;
        }

        httpRequest.body = JSON.stringify(requestbody);
        console.log(tl.loc("RunAcrTask", acrTaskName));
        console.log(JSON.stringify(requestbody));
        this.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode === 200 || statusCode === 202) {
                var runId = response.body.properties.runId;
                var status = response.body.properties.status;
                console.log(tl.loc("ScheduledAcrTaskRun", acrTaskName, runId, status));
                return new ApiResult(null, runId);
            }
            else {
                // Generate exception
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public cancelRun(runId: string, callback?: ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let acrTaskName = this.acrTask.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs();

        const requestMethod = "POST";
        var requestUri = this.getRequestUri(
            `${acrTaskbaseUri}/runs/{runId}/cancel`,
            {
                '{resourceGroupName}': resourceGroupName,
                '{registryName}': acrRegName,
                '{runId}': runId
            });

        var httpRequest = this._createHttpRequest(requestMethod, requestUri);

        console.log(tl.loc("CancelAcrTaskRun", runId, acrTaskName));
        this.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode === 200 || statusCode === 202) {
                console.log(tl.loc("CancelledAcrTaskRun", runId, acrTaskName));
                return new ApiResult(null);
            }
            else {
                // Generate exception
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public getLogLink(runId: string, callback?: ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs();

        const requestMethod = "POST";
        var requestUri = this.getRequestUri(
            `${acrTaskbaseUri}/runs/{runId}/listLogSasUrl`,
            {
                '{resourceGroupName}': resourceGroupName,
                '{registryName}': acrRegName,
                '{runId}': runId
            });

        var httpRequest = this._createHttpRequest(requestMethod, requestUri);
        console.log(tl.loc("GetLogLinkForRun", runId));
        this.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode === 200) {
                var logLink = response.body.logLink;
                tl.debug("Response for get log link for acr task " + JSON.stringify(response));
                console.log(tl.loc("LogLinkForRun", runId, logLink));
                return new ApiResult(null, logLink);
            }
            else {
                // Generate exception
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public getRun(runId: string, callback?: ApiCallback): void {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs();

        const requestMethod = "GET";
        var requestUri = this.getRequestUri(
            `${acrTaskbaseUri}/runs/{runId}`,
            {
                '{resourceGroupName}': resourceGroupName,
                '{registryName}': acrRegName,
                '{runId}': runId
            });

        var httpRequest = this._createHttpRequest(requestMethod, requestUri);
        tl.debug("Getting run");
        this.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode === 200) {
                return new ApiResult(null, response.body.properties);
            }
            else {
                // Generate exception
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));

    }

    private _createHttpRequest(method: string, requestUri): webClient.WebRequest {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = method;
        httpRequest.headers = {};
        httpRequest.uri = requestUri
        return httpRequest;
    }

    private _getRequestBodyForAddOrUpdateTask(): AcrTaskRequest.IAcrTaskRequestBody {
        let tags: { [key: string]: string } = {};
        tags["taskVersion"] = this._getTaskVersion();
        let platform = {
            os: tl.getInput("os"),
            architecture: tl.getInput("architecture")
        } as AcrTaskRequest.IPlatformProperties;

        let step = {} as AcrTaskRequest.ITaskStepProperties;
        if (this.acrTask.taskRequestStepType === AcrTaskRequest.TaskRequestStepType.EncodedTask) {
            step = this._getEncodedTaskStep();
        }
        else {
            step = this._getFileTaskStep();
        }

        var requestBody = {
            location: this.acrTask.registry.location,
            identity: {
                "type": "SystemAssigned"
            },
            tags: tags,
            properties: {
                "status": "Enabled",
                platform: platform,
                step: step as AcrTaskRequest.ITaskStepProperties
            }
        } as AcrTaskRequest.IAcrTaskRequestBody;

        if (this.acrTask.contextType == "git") {
            const pat = tl.getInput("pat", false);
            let triggerPipelineUrl = "";
            let triggerPayloadType = "";
            if (pat) {
                triggerPipelineUrl = this.getPipelineUrl(pat);
                triggerPayloadType = "token"
            }

            let triggerName = this.acrTask.name + tinyGuid();
            let baseImageTrigger = {
                status: "Enabled",
                baseImageTriggerType: "Runtime",
                name: triggerName,
                updateTriggerEndpoint: triggerPipelineUrl,
                updateTriggerPayloadType: triggerPayloadType
            } as AcrTaskRequest.IBaseImageTrigger

            let trigger = {
                baseImageTrigger: baseImageTrigger
            } as AcrTaskRequest.ITrigger

            let agentConfiguration = {
                cpu: "2"
            } as AcrTaskRequest.IAgentConfiguration

            requestBody.properties.agentConfiguration = agentConfiguration;
            requestBody.properties.trigger = trigger;

        }

        return requestBody;
    }

    private getPipelineUrl(pat: string) {
        const orgUrl = tl.getVariable('System.TeamFoundationCollectionUri').replace("://", `://:${pat}@`); // this would convert https://dev.azure.com/mseng to https://:pat@dev.azure.com
        const project = tl.getVariable('System.TeamProjectId');
        
        if (tl.getVariable('SYSTEM_HOSTTYPE').toLowerCase() === 'release') {
            const definitionId = tl.getVariable('Release.DefinitionId');
            return `${orgUrl}/${project}/_apis/release/releases?api-version=6.0-preview&definitionId=${definitionId}`
        } else {
            const definitionId = tl.getVariable('System.DefinitionId');
            return `${orgUrl}/${project}/_apis/build/builds?api-version=6.0-preview&definitionId=${definitionId}`
        }
    }

    private _getEncodedTaskStep(): AcrTaskRequest.EncodedTaskStep {
        try {
            var buildString = TaskUtil.createBuildCommand(this.acrTask);
            let imageNames: string[] = TaskUtil.getImageNames(this.acrTask);
            var taskSteps: AcrTaskRequest.TaskStep[] = []

            //add build step
            var buildTaskStep = new AcrTaskRequest.TaskStep();
            buildTaskStep.build = buildString;
            taskSteps.push(buildTaskStep);

            //add push step
            var pushTaskStep = new AcrTaskRequest.TaskStep();
            pushTaskStep.push = imageNames;
            taskSteps.push(pushTaskStep);

            // create task json
            var taskJson = new AcrTaskRequest.TaskJson();
            taskJson.version = "v1.0.0";
            taskJson.steps = taskSteps;

            //convert to yaml
            var yamlFile = yaml.safeDump(taskJson, ({ lineWidth: -1 } as any));
            var encodedTaskContent = (new Buffer(yamlFile.toString())).toString('base64');

            var encodedTask = {
                type: AcrTaskRequest.TaskRequestStepType.EncodedTask,
                encodedTaskContent: encodedTaskContent
            } as AcrTaskRequest.EncodedTaskStep;

            if (this.acrTask.contextType == "git") {
                encodedTask.contextPath = this.acrTask.context;
                encodedTask.contextAccessToken = this.acrTask.contextAccessToken;
            }
            else {
                encodedTask.contextPath = null;
                encodedTask.contextAccessToken = null;
            }

            if (!!this.acrTask.valuesFilePath) {
                var encodedValuesContent = (new Buffer(this.acrTask.valuesFilePath)).toString('base64');
                encodedTask.encodedValuesContent = encodedValuesContent
            }

            return encodedTask;
        }
        catch (error) {
            throw new Error(tl.loc("FailedToCreateEncodedTaskStep", error));
        }
    }

    private _getFileTaskStep(): AcrTaskRequest.IFileTaskStep {
        var fileTask = {
            type: AcrTaskRequest.TaskRequestStepType.FileTask,
            taskFilePath: this.acrTask.taskFile,
        } as AcrTaskRequest.IFileTaskStep;

        if (this.acrTask.contextType == "git") {
            fileTask.contextPath = this.acrTask.context;
            fileTask.contextAccessToken = this.acrTask.contextAccessToken;
        }
        else {
            fileTask.contextPath = dummyContextUrl;
            fileTask.contextAccessToken = null;
        }

        if (!!this.acrTask.valuesFilePath) {
            fileTask.valuesFilePath = this.acrTask.valuesFilePath;
        }

        return fileTask;
    }

    private _validateAcrInputs() {
        try {
            this.isValidResourceGroupName(this.acrTask.registry.resourceGroup);
            if (!this.isNameValid(this.acrTask.registry.name)) {
                throw new Error(tl.loc("AcrRegNameCannotBeEmpty"));
            }
            if (!this.isNameValid(this.acrTask.name)) {
                throw new Error(tl.loc("AcrTaskNameCannotBeEmpty"));
            }
        }
        catch (error) {
            throw Error(error);
        }
    }

    private _getTaskVersion() {
        var version = this.acrTask.version;
        if (this.updateTask) {
            version = semver.inc(this.acrTask.version, 'patch');
        }

        return version
    }
}
