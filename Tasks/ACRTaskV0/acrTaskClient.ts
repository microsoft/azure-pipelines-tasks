import msRestAzure = require('azure-arm-rest-v2/azure-arm-common');
import { ApiResult, ApiCallback, ServiceClient, ToError } from "azure-arm-rest-v2/AzureServiceClient" ;
import webClient = require("azure-arm-rest-v2/webClient");
import tl = require("azure-pipelines-task-lib/task");
import * as AcrTaskRequest from "./acrtaskrequestbody";
import * as utils from "./utils";
import * as yaml from "js-yaml";

export class ACRRegistry {
    name: string;
    location: string;
    resourceGroup: string;
    loginServer: string;
}

export class AcrTask{
    name: string;
    registry: ACRRegistry;
    imageNames: string[];
    dockerFile: string;
    yamlFile: string;
    context: string;
    contextAccessToken: string;
    taskRequestStepType: string;
    valuesFilePath: string;
    arguments: string
}

const acrTaskbaseUri : string = "//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.ContainerRegistry/registries/{registryName}/tasks/{taskName}" ;

export class AcrTaskClient extends ServiceClient {
    public acrTask: AcrTask;
    public createTask : boolean = false;
    public updateTask :  boolean = false;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, 
        subscriptionId: string,
        acrTask: AcrTask) {

        super(credentials, subscriptionId);

        this.acrTask = acrTask;
        this.apiVersion = '2019-06-01-preview';
    }

    public async getTask(callback?: ApiCallback)
    {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let acrTaskName = this.acrTask.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs(resourceGroupName, acrRegName, acrTaskName);
        
        var requestUri = this.getRequestUri(
            acrTaskbaseUri,
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
            tl.debug("Response for get acr task " + JSON.stringify(response));
            if (statusCode === 200) {
                // Generate Response
                this.updateTask = true;
                console.log(tl.loc("UpdateAcrTask", this.acrTask.name));
                return new ApiResult(null);
            }
            else if (statusCode === 404)
            {
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

    public async createOrUpdateTask(callback?: ApiCallback)
    {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let acrTaskName = this.acrTask.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs(resourceGroupName, acrRegName, acrTaskName);

        var requestUri = this.getRequestUri(
            acrTaskbaseUri,
            {
                '{resourceGroupName}': resourceGroupName,
                '{registryName}': acrRegName,
                '{taskName}': acrTaskName
            });

        var requestMethod = "PUT";    
        if (this.updateTask)
        {
            requestMethod = 'PATCH';
        }

        var httpRequest = this._createHttpRequest(requestMethod, requestUri);
        let requestBody : AcrTaskRequest.IAcrTaskRequestBody = this._getRequestBodyForAddOrUpdateTask();
        tl.debug(JSON.stringify(requestBody));
        httpRequest.body = JSON.stringify(requestBody);

        this.beginRequest(httpRequest).then(async (response) => {
            var statusCode = response.statusCode;
            tl.debug("Response for createOrUpdate acr task " + JSON.stringify(response));
            if (statusCode === 200) {
                // Generate Response
                if(this.createTask)
                {
                    console.log(tl.loc("CreatedAcrTask", this.acrTask.name));
                }
                else
                {
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

    public runTask(taskId: string, callback?: ApiCallback): void
    { 
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let acrTaskName = this.acrTask.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs(resourceGroupName, acrRegName, acrTaskName);
        
        const requestMethod = "POST";
        var requestUri = this.getRequestUri(
            "//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.ContainerRegistry/registries/{registryName}/scheduleRun",
            {
                '{resourceGroupName}': resourceGroupName,
                '{registryName}': acrRegName
            });

        var httpRequest = this._createHttpRequest(requestMethod, requestUri);
        let overrideTaskStepProperties = {} as AcrTaskRequest.IOverrideTaskStepProperties;

        // provide override values when request step type is encoded
        if (this.acrTask.taskRequestStepType == AcrTaskRequest.TaskRequestStepType.EncodedTask)
        {
            var runValues = utils.getListOfTagValuesForImageNames(this.acrTask);
            overrideTaskStepProperties = {
                arguments: [],
                values: runValues
            } as AcrTaskRequest.IOverrideTaskStepProperties;
        }

        let requestbody = {
            "type" : "TaskRunRequest",
            taskId: taskId,
            taskName: acrTaskName,
            overrideTaskStepProperties: overrideTaskStepProperties
        } as AcrTaskRequest.ITaskRunRequest;

        httpRequest.body = JSON.stringify(requestbody);
        console.log(tl.loc("RunAcrTask", acrTaskName));
        this.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            var statusCode = response.statusCode;
            tl.debug("Response for run Acr task " + JSON.stringify(response));
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

    public cancelRun(runId: string, callback?: ApiCallback): void
    { 
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let acrTaskName = this.acrTask.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs(resourceGroupName, acrRegName, acrTaskName);
        
        const requestMethod = "POST";
        var requestUri = this.getRequestUri(
            "//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.ContainerRegistry/registries/{registryName}/runs/{runId}/cancel",
            {
                '{resourceGroupName}': resourceGroupName,
                '{registryName}': acrRegName,
                '{runId}': runId
            });

        var httpRequest = this._createHttpRequest(requestMethod, requestUri);

        console.log(tl.loc("CancelAcrTaskRun", runId, acrTaskName));
        this.beginRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            var statusCode = response.statusCode;
            if (statusCode === 200 || statusCode === 202) 
            {
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

    public getLogLink(runId:string, callback?: ApiCallback): void
    {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let acrTaskName = this.acrTask.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs(resourceGroupName, acrRegName, acrTaskName);
        
        const requestMethod = "POST";
        var requestUri = this.getRequestUri(
            "//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.ContainerRegistry/registries/{registryName}/runs/{runId}/listLogSasUrl",
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

    public getRun(runId:string, callback?: ApiCallback): void
    {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        let acrRegName = this.acrTask.registry.name;
        let acrTaskName = this.acrTask.name;
        let resourceGroupName = this.acrTask.registry.resourceGroup;

        // Validate
        this._validateAcrInputs(resourceGroupName, acrRegName, acrTaskName);
        
        const requestMethod = "GET";
        var requestUri = this.getRequestUri(
            "//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.ContainerRegistry/registries/{registryName}/runs/{runId}",
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
                tl.debug("Response for get run" + JSON.stringify(response));
                return new ApiResult(null, response.body.properties);
            }
            else {
                // Generate exception
               return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
        (error) => callback(error));
        
    }

    private _createHttpRequest(method: string, requestUri): webClient.WebRequest
    {     
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = method;
        httpRequest.headers = {};
        httpRequest.uri = requestUri
        return httpRequest;
    }

    private  _getRequestBodyForAddOrUpdateTask() : AcrTaskRequest.IAcrTaskRequestBody
    {
        let tags: {[key: string]: string} = {};
        let platform = {
            os : tl.getInput("os"),
            architecture : tl.getInput("architecture") 
        } as AcrTaskRequest.IPlatformProperties ;

        let step = {} as AcrTaskRequest.ITaskStepProperties;
        if (this.acrTask.taskRequestStepType === AcrTaskRequest.TaskRequestStepType.EncodedTask)
        {
            step = this._getEncodedTaskStep();
        }
        else
        {
            step = this._getFileTaskStep();
        }

        return {
            location: this.acrTask.registry.location,
            identity: {
                "type" : "SystemAssigned"
            },
			tags: tags,
			properties: {
                "status": "Enabled",
                platform : platform,
				step: step as AcrTaskRequest.ITaskStepProperties
			}
		} as AcrTaskRequest.IAcrTaskRequestBody;
    }

    private _getEncodedTaskStep(): AcrTaskRequest.EncodedTaskStep{
        try{
            var buildString = utils.createBuildCommand(this.acrTask);
            let imageNames: string[] = utils.convertToImageNamesWithValuesTag(this.acrTask);
            var taskSteps : AcrTaskRequest.TaskStep[] = []
    
            //add build step
            var buildTaskStep  = new AcrTaskRequest.TaskStep();
            buildTaskStep.build = buildString;
            taskSteps.push(buildTaskStep);
    
            //add push step
            var pushTaskStep  = new AcrTaskRequest.TaskStep();
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
                type : AcrTaskRequest.TaskRequestStepType.EncodedTask,
                encodedTaskContent: encodedTaskContent,
                contextPath: this.acrTask.context,
                contextAccessToken: this.acrTask.contextAccessToken
            } as AcrTaskRequest.EncodedTaskStep;
    
            if(!!this.acrTask.valuesFilePath)
            {
                var encodedValuesContent = (new Buffer(this.acrTask.valuesFilePath)).toString('base64');
                encodedTask.encodedValuesContent = encodedValuesContent
            }
    
            return encodedTask;
        }
        catch(error)
        {
            throw new Error(tl.loc("FailedToCreateEncodedTaskStep", error));
        }
    }

    private _getFileTaskStep(): AcrTaskRequest.IFileTaskStep{
        var fileTask = {
            type : AcrTaskRequest.TaskRequestStepType.FileTask,
            taskFilePath : this.acrTask.yamlFile,
            contextPath: this.acrTask.context,
            contextAccessToken: this.acrTask.contextAccessToken
        } as AcrTaskRequest.IFileTaskStep;

        if(!!this.acrTask.valuesFilePath)
        {
            fileTask.valuesFilePath = this.acrTask.valuesFilePath;
        }

        return fileTask; 
    }

    private _validateAcrInputs(resourceGroupName: string, acrRegName:string, acrTaskName: string)
    {
        try {
            this.isValidResourceGroupName(resourceGroupName);
            if(!this.isNameValid(acrRegName)){
                throw new Error(tl.loc("AcrRegNameCannotBeEmpty"));
            }
            if(!this.isNameValid(acrTaskName)){
                throw new Error(tl.loc("AcrTaskNameCannotBeEmpty"));
            }
        }
        catch (error) {
            throw Error(error);
        }
    }
}
