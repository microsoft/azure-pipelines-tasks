import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import msRestAzure = require("azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common");
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import { TaskUtil } from "../utilities/utils";
import { TaskRequestStepType } from "./acrtaskrequestbody";
import { AzureEndpoint } from "azure-pipelines-tasks-azure-arm-rest-v2/azureModels";
import { Resources } from "azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-resource";

class AcrRegistry {
    name: string;
    location: string;
    resourceGroup: string;
    loginServer: string;
}

export class AcrTask {
    contextType: string
    version: string;
    name: string;
    repository: string;
    tags: string[];
    registry: AcrRegistry;
    dockerFile: string;
    taskFile: string;
    context: string;
    contextAccessToken: string;
    taskRequestStepType: string;
    valuesFilePath: string;
    arguments: string;
    architecture: string;
    os: string;
}

export default class AcrTaskParameters {

    public acrTask: AcrTask;
    public subscriptionId: string;
    public credentials: msRestAzure.ApplicationTokenCredentials;

    public async getAcrTaskParameters() {
        try {
            var connectedService = tl.getInput("connectedServiceName", true);
            var endpoint = await new AzureRMEndpoint(connectedService).getEndpoint();
            this.credentials = endpoint.applicationTokenCredentials;
            this.subscriptionId = endpoint.subscriptionID;
            this.acrTask = this.getAcrTaskStepDetails();
            let azureContainerRegistry = tl.getInput("azureContainerRegistry", true);
            this.acrTask.registry = await this.getContainerRegistryDetails(endpoint, azureContainerRegistry);
            return this;
        }
        catch (error) {
            throw new Error(tl.loc("TaskConstructorFailed", error.message));
        }
    }

    private getAcrTaskStepDetails(): AcrTask {
        let acrTask = new AcrTask();
        acrTask.name = tl.getVariable('TASK.DISPLAYNAME');
        acrTask.os = tl.getInput("os", true);
        acrTask.architecture = tl.getInput("architecture", true);

        acrTask.contextType = tl.getInput("contextType", true);
        
        if (acrTask.contextType == "git") {
            //populate context path and accesstoken
            this.populateGitContextDetails(acrTask)
        }

        let dockerfileOrTaskFile = tl.getInput("dockerfileOrTaskFile", true);
        // check whether dockerfile or yaml
        if(!dockerfileOrTaskFile) {
           throw new Error(tl.loc("PathNotSet"));
        }
        else if (path.extname(dockerfileOrTaskFile) == ".yaml" || path.extname(dockerfileOrTaskFile) == ".yml") {
            // file task step for yaml
            this.setFileTaskAcrTaskInputs(acrTask, dockerfileOrTaskFile);
        }
        else {
            // encoded task step for dockerfile
            this.setEncodedTaskInputs(acrTask, dockerfileOrTaskFile);
        }

        return acrTask;
    }

    private setEncodedTaskInputs(acrTask: AcrTask, dockerfileOrYaml: string) {
        acrTask.taskRequestStepType = TaskRequestStepType.EncodedTask;
        acrTask.dockerFile = dockerfileOrYaml;
        acrTask.repository =tl.getInput("containerRepository"); 
        acrTask.tags = tl.getDelimitedInput("tags", "\n");
        acrTask.arguments = tl.getInput("arguments");
    }

    private setFileTaskAcrTaskInputs(acrTask: AcrTask, dockerfileOrYaml: string) {
        acrTask.taskRequestStepType = TaskRequestStepType.FileTask;
        acrTask.taskFile = dockerfileOrYaml;
        acrTask.valuesFilePath = tl.getInput("valuesFilePath");
    }

    private async getContainerRegistryDetails(endpoint: AzureEndpoint, resourceName: string): Promise<AcrRegistry> {
        var azureResources: Resources = new Resources(endpoint);
        var filteredResources: Array<any> = await azureResources.getResources('Microsoft.ContainerRegistry/registries', resourceName);
        if(!filteredResources || filteredResources.length == 0) {
            throw new Error(tl.loc('ResourceDoesntExist', resourceName));
        }
        else if(filteredResources.length == 1) {
            var acrRegistryObject = filteredResources[0];
            let acrRegistry = new AcrRegistry();
            acrRegistry.name = resourceName;
            acrRegistry.location = acrRegistryObject.location;
            acrRegistry.resourceGroup = TaskUtil.getResourceGroupNameFromUrl(acrRegistryObject.id);
            acrRegistry.loginServer = acrRegistryObject.loginServer
            return acrRegistry;
        }
        else {
            throw new Error(tl.loc('MultipleResourceGroupFoundForContainerRegistry', resourceName));
        }
    }

    private getGithubEndPointToken(): string {
        var endpoint = tl.getInput("githubConnection", true);
        const githubEndpointObject = tl.getEndpointAuthorization(endpoint, false);
        let githubEndpointToken: string = null;
    
        if (!!githubEndpointObject) {
            tl.debug('Endpoint scheme: ' + githubEndpointObject.scheme);
    
            if (githubEndpointObject.scheme === 'PersonalAccessToken') {
                githubEndpointToken = githubEndpointObject.parameters.accessToken;
            } else if (githubEndpointObject.scheme === 'OAuth') {
                githubEndpointToken = githubEndpointObject.parameters.AccessToken;
            } else if (githubEndpointObject.scheme === 'Token') {
                githubEndpointToken = githubEndpointObject.parameters.AccessToken;
            } else if (githubEndpointObject.scheme) {
                throw new Error(tl.loc('InvalidEndpointAuthScheme', githubEndpointObject.scheme));
            }
        }
    
        if (!githubEndpointToken) {
            throw new Error(tl.loc('InvalidGitHubEndpoint', endpoint));
        }
    
        return githubEndpointToken;
    }

    private populateGitContextDetails(acrTask: AcrTask): void
    {
        var repoName = tl.getInput("repositoryName", true);
        var branch = tl.getInput("branch", true);
        const contextPath = `https://github.com/${repoName}.git#${branch}`;
       
        acrTask.context = contextPath;
        acrTask.contextAccessToken = this.getGithubEndPointToken();
    }
}
