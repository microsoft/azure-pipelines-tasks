import * as os from "os";
import * as acrTaskRequest from "../models/acrtaskrequestbody";
import * as imageUtils from "azure-pipelines-tasks-docker-common-v2/containerimageutils";
import * as pipelineUtils from "azure-pipelines-tasks-docker-common-v2/pipelineutils";
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import Q = require('q');
import fs = require('fs');
import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import { AcrTask } from "../models/acrtaskparameters";
import webClient = require("azure-pipelines-tasks-azure-arm-rest-v2/webClient");
import { getBaseImageNameFromDockerFile } from "azure-pipelines-tasks-docker-common-v2/containerimageutils";
var archiver = require('archiver');

export class ArchiveUtil {
    public static getTempDirectory(): string {
        return tl.getVariable('agent.tempDirectory') || os.tmpdir();
    }
    
    public static getCurrentTime(): number {
        return new Date().getTime();
    }
    
    public static getNewUserDirPath(): string {
        var userDir = path.join(this.getTempDirectory(), "kubectlTask");
        this.ensureDirExists(userDir);
    
        userDir = path.join(userDir, this.getCurrentTime().toString());
        this.ensureDirExists(userDir);
    
        return userDir;
    } 
    
    public static ensureDirExists(dirPath : string) : void
    {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        }
    }
    
    public static async archiveFolder(folderPath, targetPath, zipName) {
        var defer = Q.defer();
        tl.debug('Archiving ' + folderPath + ' to ' + zipName);
        var outputZipPath = path.join(targetPath, zipName);
        var output = fs.createWriteStream(outputZipPath);
        var archive = archiver('tar', {
            gzip: true,
            gzipOptions: {
              level: 1
            }
          });
        
        output.on('close', function () {
            console.log(archive.pointer() + ' total bytes');
            tl.debug('Successfully created archive ' + zipName);
            defer.resolve(outputZipPath);
        });
    
        output.on('error', function(error) {
            defer.reject(error);
        });
        
        archive.glob("**", {
            cwd: folderPath,
            dot: true,
            ignore: [".git/**", ".gitignore"]
        });
        archive.pipe(output);
        archive.finalize();
    
        return defer.promise;
    }
    
    public static getArchiveFilePath(fileName: string): string {
    
        var tempDir = this.getNewUserDirPath();
        var archiveFilePath = path.join(tempDir, fileName);
    
        return archiveFilePath;
    }
}

export class TaskUtil {

    public static getResourceGroupNameFromUrl(id: string): string {
        if(!id){
            throw new Error(tl.loc("UnableToFindResourceGroupDueToNullId"));
        }
        const pathArray =id.split("/");
        if(pathArray.length <=0 || !pathArray[3] || pathArray[3].toLowerCase() != 'resourcegroups'){
            throw new Error(tl.loc("UnableToFindResourceGroupDueToInvalidId"));
        }

        return pathArray[4];
    }

    public static getListOfTagValuesForImageNames(acrTask: AcrTask): acrTaskRequest.Value[] {
        let runValues : acrTaskRequest.Value[] = [];
        acrTask.tags.forEach(function(tag, index) {
            var runValue = new acrTaskRequest.Value();
            runValue.name =  "Tag" + index + "";
            runValue.value = tag
            runValue.isSecret = false;
            runValues.push(runValue);
        });

        return runValues;
    }

    public static addRunRegistryToImageName(repository: string): string {
        const registryTag =  "{{.Run.Registry}}/";
        if(!imageUtils.hasRegistryComponent(repository))
        {
            repository = registryTag.concat(repository);
        }
    
        return repository
    }
    
    public static getImageNames(acrTask: AcrTask): string[] {
        let tags: string[] = [...acrTask.tags];
        let imageNamesWithTags: string[] = []

        var imageNameWithoutTag = TaskUtil.addRunRegistryToImageName(acrTask.repository);
        tags.forEach(function(tag, index) {  
            var tagValue = ""
            if (acrTask.contextType == "git")
            {
                tagValue = ":" + tag + "";     
            }
            else
            {
                tagValue = ":{{.Values.Tag" + index + "}}";
            }          

            imageNamesWithTags.push(imageNameWithoutTag.concat(tagValue));
        });
    
        return imageNamesWithTags;  
    }

    public static async streamToString(readableStream) {
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
    
    public static createBuildCommand(acrTask: AcrTask): string {
        let buildString : string =  "";
        //add image names
        let imageNames: string[] = this.getImageNames(acrTask);
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

    public static async publishLogs(logLink: string) { 
        var logfilepath = await toolLib.downloadTool(logLink);
        var readstream =  fs.createReadStream(logfilepath);
        console.log(tl.loc("DownloadedRunLogs"), await TaskUtil.streamToString(readstream));
    }
}

export class MetadatUtil {

    public static async publishToImageMetadataStore(outputImages: acrTaskRequest.OutputImage[], dockerFilePath?: string): Promise<any> {
        const build = "build";
        const hostType = tl.getVariable("System.HostType").toLowerCase();
        const runId = hostType === build ? parseInt(tl.getVariable("Build.BuildId")) : parseInt(tl.getVariable("Release.ReleaseId"));
        const pipelineVersion =  hostType === build ? tl.getVariable("Build.BuildNumber") : tl.getVariable("Release.ReleaseName");
        const pipelineName = tl.getVariable("System.DefinitionName");
        const pipelineId = tl.getVariable("System.DefinitionId");
        const jobName = tl.getVariable("System.PhaseDisplayName");


        const baseImageName = dockerFilePath && fs.existsSync(dockerFilePath) ? getBaseImageNameFromDockerFile(dockerFilePath) : "NA";

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
        
                let imageUri = "https://" + outputImages[i].registry + "/" + outputImages[i].repository + "@" + outputImages[i].digest;
        
                const requestBody: string = JSON.stringify(
                    {
                        "imageName": imageUri,
                        "imageUri": imageUri,
                        "hash": outputImages[i].digest,
                        "baseImageName": baseImageName,
                        "distance": 0,
                        "imageType": "",
                        "mediaType": "",
                        "tags": tags,
                        "layerInfo": [],
                        "runId": runId,
                        "pipelineVersion": pipelineVersion,
                        "pipelineName": pipelineName,
                        "pipelineId": pipelineId,
                        "jobName": jobName,
                        "imageSize": ""
                    }
                );
            
                await this.sendRequestToImageStore(requestBody, requestUrl);
            }
        }
        catch(error)
        {
            tl.debug("Unable to push to Image Details Artifact Store, Error: " + error);
        }
    }
    
    public static async sendRequestToImageStore(requestBody: string, requestUrl: string): Promise<any> {
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
}
