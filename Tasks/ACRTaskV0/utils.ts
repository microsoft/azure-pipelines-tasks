import tl = require("azure-pipelines-task-lib/task");
import * as acrTaskRequest from "./acrtaskrequestbody";
import * as imageUtils from "docker-common-v2/containerimageutils";
import * as pipelineUtils from "docker-common-v2/pipelineutils";
import { Resources } from 'azure-arm-rest-v2/azure-arm-resource';
import { AzureEndpoint } from 'azure-arm-rest-v2/azureModels';
import { AcrTask, ACRRegistry } from "./acrtaskclient";
import webClient = require("azure-arm-rest-v2/webClient");

export function populateContextDetails(acrTask: AcrTask): void
{
    var repoUri = tl.getInput("repoUrl", true);
    var branch = tl.getInput("branch", true);
    var connectionType = tl.getInput("connectionType", true);
    var connection = "";
    var accessToken = "";
    if(connectionType == "github")
    {
        connection = tl.getInput("githubConnection", true);
        accessToken = tl.getEndpointAuthorizationParameter(connection, 'AccessToken', false);
    }

    repoUri = repoUri.endsWith("/") ? repoUri.substring(0, repoUri.length - 1): repoUri;
    var convertedGitRepoUri = repoUri.endsWith(".git") ? repoUri : repoUri.concat(".git");
    var contextPath = convertedGitRepoUri.concat("#", branch);

    acrTask.context = contextPath;
    acrTask.contextAccessToken = accessToken;
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
        acrRegistry.loginServer = resourceName.concat(".azurecr.io");
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

export async function publishToImageMetadataStore(outputImages: acrTaskRequest.OutputImage[]): Promise<any> {
    const build = "build";
    const hostType = tl.getVariable("System.HostType").toLowerCase();
    const runId = hostType === build ? parseInt(tl.getVariable("Build.BuildId")) : parseInt(tl.getVariable("Release.ReleaseId"));
    const pipelineVersion =  hostType === build ? tl.getVariable("Build.BuildNumber") : tl.getVariable("Release.ReleaseName");
    const pipelineName = tl.getVariable("System.DefinitionName");
    const pipelineId = tl.getVariable("System.DefinitionId");
    const jobName = tl.getVariable("System.PhaseDisplayName");

    const requestUrl = tl.getVariable("System.TeamFoundationCollectionUri") + tl.getVariable("System.TeamProject") + "/_apis/deployment/imagedetails?api-version=5.0-preview.1";
    
    try
    {
        //get all distinct qualified image names and then get the respective tags for them
        var flags = [];
        for(var i = 0; i < outputImages.length; i++)
        {
            var qualifiedImageName  = outputImages[i].registry.concat("/", outputImages[i].repository);
            if(flags[qualifiedImageName]) 
            {
                continue;
            }

            flags[qualifiedImageName] = true;
            var filteredOutputImages = outputImages.filter(function(image) {
                return image.registry.concat("/", image.repository) == qualifiedImageName;
            });
    
            var tags: string[] = [];
    
            filteredOutputImages.forEach(function(image) {
                tags.push(image.tag);
            });
    
            let imageUri = "https://" + outputImages[i].registry + "/" + outputImages[i].repository + "@" + outputImages[i].digest +"";
    
            const requestBody: string = JSON.stringify(
                {
                    "imageName": imageUri,
                    "imageUri": imageUri,
                    "hash": outputImages[i].digest,
                    "baseImageName": "",
                    "distance": 0,
                    "imageType": "",
                    "mediaType": "",
                    "tags": tags,
                    "layerInfo": "",
                    "runId": runId,
                    "pipelineVersion": pipelineVersion,
                    "pipelineName": pipelineName,
                    "pipelineId": pipelineId,
                    "jobName": jobName,
                    "imageSize": ""
                }
            );
        
            await sendRequestToImageStore(requestBody, requestUrl);
        }
    }
    catch(error)
    {
        tl.debug("Unable to push to Image Details Artifact Store, Error: " + error);
    }
}

async function sendRequestToImageStore(requestBody: string, requestUrl: string): Promise<any> {
    const request = new webClient.WebRequest();
    const accessToken: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
    request.uri = requestUrl;
    request.method = 'POST';
    request.body = requestBody;
    request.headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken
    };

    tl.debug("requestUrl: " + requestUrl);
    tl.debug("requestBody: " + requestBody);
    tl.debug("accessToken: " + accessToken);

    try {
        tl.debug("Sending request for pushing image to Image meta data store");
        const response = await webClient.sendRequest(request);
        return response;
    }
    catch (error) {
        tl.debug("Unable to push to Image Details Artifact Store, Error: " + error);
    }

    return Promise.resolve();
}