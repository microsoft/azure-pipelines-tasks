import tl = require("azure-pipelines-task-lib/task");
import msRestAzure = require("azure-arm-rest-v2/azure-arm-common");
import { AzureRMEndpoint } from 'azure-arm-rest-v2/azure-arm-endpoint';
import { TaskUtil } from "../utilities/utils";
import { TaskRequestStepType } from "./acrtaskrequestbody";
import { AzureEndpoint } from "azure-arm-rest-v2/azureModels";
import { Resources } from "azure-arm-rest-v2/azure-arm-resource";

class AcrRegistry {
    name: string;
    location: string;
    resourceGroup: string;
    loginServer: string;
}

export class AcrTask {
    version: string;
    name: string;
    imageNames: string[];
    registry: AcrRegistry;
    dockerFile: string;
    taskFile: string;
    context: string;
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

        let dockerfileOrTaskFile = tl.getInput("dockerfileOrTaskFile", true);
        // check whether dockerfile or yaml
        let path = dockerfileOrTaskFile.split("/");
        if(!path) {
           throw new Error(tl.loc("PathNotSet"));
        }
        else if (path[path.length -1].endsWith(".yaml") || path[path.length -1].endsWith(".yml")) {
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
        acrTask.imageNames = tl.getDelimitedInput("imageNames", "\n");
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
            acrRegistry.loginServer = resourceName.concat(".azurecr.io");
            return acrRegistry;
        }
        else {
            throw new Error(tl.loc('MultipleResourceGroupFoundForContainerRegistry', resourceName));
        }
    }
}
