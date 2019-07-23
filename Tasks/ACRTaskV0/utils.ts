import tl = require("azure-pipelines-task-lib/task");
import * as acrTaskRequest from "./acrTaskRequestBody";
import * as imageUtils from "docker-common-v2/containerimageutils";
import * as pipelineUtils from "docker-common-v2/pipelineutils";
import { AcrTask } from "./acrTaskClient";

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

export function getRegistryNameFromUrl(id: string): string{
    if(!id){
        throw new Error(tl.loc("UnableToFindRegistryDueToNullId"));
    }
    const pathArray =id.split("/");
    if(pathArray[7] != 'registries'){
        throw new Error(tl.loc("UnableToFindRegistryDueToInvalidId"));
    }
    return pathArray[8];
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

