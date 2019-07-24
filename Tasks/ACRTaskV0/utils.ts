import tl = require("azure-pipelines-task-lib/task");
import * as acrTaskRequest from "./acrtaskrequestbody";
import * as imageUtils from "docker-common-v2/containerimageutils";
import * as pipelineUtils from "docker-common-v2/pipelineutils";
import { Resources } from 'azure-arm-rest-v2/azure-arm-resource';
import { AzureEndpoint } from 'azure-arm-rest-v2/azureModels';
import { AcrTask, ACRRegistry } from "./acrtaskclient";

export function getContextPath(): string
{
    var repoUri = tl.getVariable("Build.Repository.Uri");
    let hostType = tl.getVariable("SYSTEM_HOSTTYPE");
    var branch = "";
    if (hostType.toLowerCase() === "build") {
       branch = tl.getVariable("Build.SourceBranchName");
    }
    else
    {
        branch = tl.getVariable("Build.SourceBranch");
    }
    var convertedGitRepoUri = repoUri.replace("https://", "git://");
    var contextPath = convertedGitRepoUri.concat("#", branch);
    return contextPath;
}

export function getResourceGroupNameFromUrl(id: string): string{
    if(!id){
        throw new Error(tl.loc("UnableToFindResourceGroupDueToNullId"));
    }
    const pathArray =id.split("/");
    if(pathArray[3] != 'resourceGroups'){
        throw new Error(tl.loc("UnableToFindResourceGroupDueToInvalidId"));
    }
    return pathArray[4];
}

export async function getContainerRegistryDetails(endpoint: AzureEndpoint, resourceName: string): Promise<ACRRegistry> {
    var azureResources: Resources = new Resources(endpoint);
    var filteredResources: Array<any> = await azureResources.getResources('Microsoft.ContainerRegistry/registries', resourceName);
    if(!filteredResources || filteredResources.length == 0) {
        throw new Error(tl.loc('ResourceDoesntExist', resourceName));
    }
    else if(filteredResources.length == 1) {
        var acrRegistryObject = filteredResources[0];
        let acrRegistry = new ACRRegistry();
        acrRegistry.name = resourceName;
        acrRegistry.location = acrRegistryObject.location;
        acrRegistry.resourceGroup = getResourceGroupNameFromUrl(acrRegistryObject.id);
        return acrRegistry;
    }
    else {
        throw new Error(tl.loc('MultipleResourceGroupFoundForContainerRegistry', resourceName));
    }
}

export function getListOfTagValuesForImageNames(acrTask: AcrTask): acrTaskRequest.Value[]
    {
        let runValues : acrTaskRequest.Value[] = [];
        acrTask.imageNames.forEach(function(name, index) {
            var runValue = new acrTaskRequest.Value();
            runValue.name =  "Tag" + index + "";
            runValue.value = imageUtils.getTagFromImageName(name),
            runValue.isSecret = false;
            runValues.push(runValue);
        });

        return runValues;
    }

export function convertToImageNamesWithValuesTag(acrTask: AcrTask): string[]
{
    let imageNamesWithValuesTags: string[] = [...acrTask.imageNames];

    imageNamesWithValuesTags.forEach(function(name, index, imageNamesWithValuesTags) {
        var imageNameWithoutTag = imageUtils.imageNameWithoutTag(name);
        imageNameWithoutTag = addRunRegistryToImageName(imageNameWithoutTag);
        var tagValue = ":{{.Values.Tag" + index + "}}";
        imageNamesWithValuesTags[index] = imageNameWithoutTag.concat(tagValue);
    });

    return imageNamesWithValuesTags;
}

export function addRunRegistryToImageName(imageNameWithoutTag: string): string
{
    const registryTag =  "{{.Run.Registry}}/";
    if(!imageUtils.hasRegistryComponent(imageNameWithoutTag))
    {
        imageNameWithoutTag = registryTag.concat(imageNameWithoutTag);
    }

    return imageNameWithoutTag
}

export async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      readableStream.on("data", data => {
        chunks.push(data.toString());
      });
      readableStream.on("end", () => {
        resolve(chunks.join(""));
      });
      readableStream.on("error", reject);
    });
  }

export function createBuildCommand(acrTask: AcrTask): string
{
    let buildString : string =  "";
    //add image names
    let imageNames: string[] = convertToImageNamesWithValuesTag(acrTask);
    imageNames.forEach(function(name, index, imageNames) {
        buildString = buildString.concat("-t ", name, " ");
    });
    
    //add default pipeline labels
    var defaultLabels = pipelineUtils.getDefaultLabels();
    defaultLabels.forEach(label => {
        buildString = buildString.concat("--label ","\"" + label + "\"", " ");
    });

    //add arguments if present
    if(!!acrTask.arguments)
    {
        buildString = buildString.concat(acrTask.arguments, " ");
    }

    //add dockerfile argument
    buildString = buildString.concat("-f ", acrTask.dockerFile, " .");
    tl.debug("Constructed build string: " + buildString);
    return buildString.trim();
}

