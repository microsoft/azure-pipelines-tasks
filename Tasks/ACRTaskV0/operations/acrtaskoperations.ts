import tl = require("azure-pipelines-task-lib/task");
import AcrTaskParameters from "../models/acrtaskparameters";
import { AcrTaskClient } from "./acrtaskclient";
import Q = require("q");
import fs = require('fs');
import path = require("path");
import { ArchiveUtil } from "../utilities/utils";
import { AzureBlobUploadHelper } from "./azure-blob-upload-helper";

export default class AcrTaskOperations {
    private taskParameters: AcrTaskParameters ;
    public acrTaskClient: AcrTaskClient;

    constructor(taskParameters: AcrTaskParameters) {
        this.taskParameters = taskParameters;
        this.acrTaskClient = new AcrTaskClient(this.taskParameters.credentials, this.taskParameters.subscriptionId, this.taskParameters.acrTask);
    }

    public async populateContextPath(): Promise<void>
    {
        var sourceContextPath = tl.getInput("contextPath", true);
        if(fs.existsSync(sourceContextPath))
        {
            var buildSourceUploadUrlResult = await this.getBuildSourceUploadUrl(this.acrTaskClient);
            if(!buildSourceUploadUrlResult || !buildSourceUploadUrlResult.uploadUrl || !buildSourceUploadUrlResult.relativePath)
            {
                throw new Error(tl.loc("FailedToExtractFromResponse", "context"));
            }

            var buildSourceUploadUrl = buildSourceUploadUrlResult.uploadUrl;
            var relativePath = buildSourceUploadUrlResult.relativePath;
            var relativePathArray = relativePath.split("/");
            var targetPath = ArchiveUtil.getNewUserDirPath();
            var archiveFilePath = path.join(targetPath, relativePathArray[2]);
            await ArchiveUtil.archiveFolder(sourceContextPath, targetPath,  relativePathArray[2]);
            const azureBlobUploadHelper = new AzureBlobUploadHelper();
            await azureBlobUploadHelper.upload(buildSourceUploadUrl, archiveFilePath);
            this.taskParameters.acrTask.context = relativePath;
        } 
        else
        {
            throw new Error(tl.loc("InvalidContextPath"));
        }
    }

    public pollGetRunStatus(runId: string): Q.Promise<any> {
        const defer: Q.Deferred<string> = Q.defer<string>();
       
        const poll = async () => {
            await this.acrTaskClient.getRun(runId, (error, result, request, response) => {
                if(error){
                    defer.reject(new Error(tl.loc("FailedToFetchRun", runId, this.acrTaskClient.getFormattedError(error))));
                }
                else if (result != null) {
                    var status = result.status;
                    console.log(tl.loc("TaskRunStatus", runId, status));
                    if(status != "Queued" &&  status != "Running" && status != "Started")
                    {
                        defer.resolve(result);
                    }
                    else 
                    {
                      // task is still not completed. keep polling
                        setTimeout(poll, 60000);
                    }
                }
            });
        };
    
        poll();
        
        return defer.promise;
    }

    public async getTask(): Promise<string> {
        let defer = Q.defer<string>();
        this.acrTaskClient.getTask((error, result, request, response) => {
            if(error){
                defer.reject(new Error(tl.loc("FailedToFetchTask", this.taskParameters.acrTask.name, this.acrTaskClient.getFormattedError(error))));
            }
            else{
                var taskVersion = "1.0.0"
                if(!!result)
                {
                    try
                    {
                        taskVersion = result.tags["taskVersion"]
                        if(!taskVersion) 
                        {
                            taskVersion = "1.0.0"
                        }
                    }
                    catch(error)
                    {
                        taskVersion = "1.0.0"
                    }
                }

                defer.resolve(taskVersion);
            }
        });
    
        return defer.promise;
    }
    
    public async createOrUpdateTask(): Promise<string> {
        let defer = Q.defer<string>();
        this.acrTaskClient.createOrUpdateTask((error, result, request, response) => {
            if(error)
            {
                defer.reject(new Error(tl.loc("FailedToCreateOrUpdateTask", this.acrTaskClient.getFormattedError(error))));
            }
            else
            {
                try
                { 
                    const taskId =  result.body.id;
                    defer.resolve(taskId);
                }
                catch(error)
                {
                    defer.reject(error);
                }
            }
        });
    
        return defer.promise;
    }
    
    public async runTask(taskId: string): Promise<string> {
        let defer = Q.defer<string>();
        this.acrTaskClient.runTask(taskId, (error, result, request, response) => {
            if(error) {
                defer.reject(new Error(tl.loc("FailedToScheduleTaskRun", this.acrTaskClient.getFormattedError(error))));
            }
            else{
               defer.resolve(result);
            }
        });
        return defer.promise;
    }
    
    public async cancelRun(runId: string): Promise<string> {
        let defer = Q.defer<string>();
        this.acrTaskClient.cancelRun(runId, (error, result, request, response) => {
            if(error){
                defer.reject(new Error(tl.loc("FailedToCancelRun", runId, this.acrTaskClient.getFormattedError(error))));
            }
        });
        return defer.promise;
    }
    
    public async getlogLink(runId: string): Promise<string> {
        let defer = Q.defer<string>();
        this.acrTaskClient.getLogLink(runId, (error, result, request, response) => {
            if(error){
                defer.reject(new Error(tl.loc("FailedToGetLogLink", runId, this.acrTaskClient.getFormattedError(error))));
            }else{
                defer.resolve(result);
            }
        });
    
        return defer.promise;
    }
    
    public async getBuildSourceUploadUrl(acrTaskClient: AcrTaskClient): Promise<any> {
        let defer = Q.defer<string>();
        acrTaskClient.getBuildSourceUploadUrl((error, result, request, response) => {
            if(error){
                defer.reject(new Error(tl.loc("FailedToGetBlobSourceUrl", acrTaskClient.getFormattedError(error))));
            }
            else{
                defer.resolve(result);
            }
        });
    
        return defer.promise;
    }
}