import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require('fs');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import { AzureRMEndpoint } from 'azure-arm-rest-v2/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest-v2/azureModels';
import Q = require('q');
import {ACRRegistry, AcrTask, AcrTaskClient} from "./acrtaskclient";
import { TaskRequestStepType, OutputImage } from "./acrtaskrequestbody";
import * as utils from "./utils";

tl.setResourcePath(path.join(__dirname, 'task.json'));
tl.setResourcePath(path.join( __dirname, 'node_modules/azure-arm-rest-v2/module.json'));

// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

async function getTask(acrTaskClient: AcrTaskClient): Promise<string> {
    let defer = Q.defer<string>();
    acrTaskClient.getTask((error, result, request, response) => {
        if(error){
            defer.reject(new Error(tl.loc("FailedToFetchTask", acrTaskClient.acrTask, acrTaskClient.getFormattedError(error))));
        }
        else{
            defer.resolve();
        }
    });

    return defer.promise;
}

async function createOrUpdateTask(acrTaskClient: AcrTaskClient): Promise<string> {
    let defer = Q.defer<string>();
    acrTaskClient.createOrUpdateTask((error, result, request, response) => {
        if(error)
        {
            defer.reject(new Error(tl.loc("FailedToCreateOrUpdateTask", acrTaskClient.getFormattedError(error))));
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

async function runTask(taskId: string, acrTaskClient: AcrTaskClient): Promise<string> {
    let defer = Q.defer<string>();
    acrTaskClient.runTask(taskId, (error, result, request, response) => {
        if(error) {
            defer.reject(new Error(tl.loc("FailedToScheduleTaskRun", acrTaskClient.getFormattedError(error))));
        }
        else{
           defer.resolve(result);
        }
    });
    return defer.promise;
}

async function cancelRun(runId: string, acrTaskClient: AcrTaskClient): Promise<string> {
    let defer = Q.defer<string>();
    acrTaskClient.cancelRun(runId, (error, result, request, response) => {
        if(error){
            defer.reject(new Error(tl.loc("FailedToCancelRun", runId, acrTaskClient.getFormattedError(error))));
        }
    });
    return defer.promise;
}

async function getlogLink(runId: string, acrTaskClient:AcrTaskClient): Promise<string> {
    let defer = Q.defer<string>();
    acrTaskClient.getLogLink(runId, (error, result, request, response) => {
        if(error){
            defer.reject(new Error(tl.loc("FailedToGetLogLink", runId, acrTaskClient.getFormattedError(error))));
        }else{
            defer.resolve(result);
        }
    });

    return defer.promise;
}

function pollGetRunStatus(runId: string, acrTaskClient: AcrTaskClient): Q.Promise<any> {
    const defer: Q.Deferred<string> = Q.defer<string>();
   
    const poll = async () => {
        await acrTaskClient.getRun(runId, (error, result, request, response) => {
            if(error){
                defer.reject(new Error(tl.loc("FailedToFetchRun", runId, acrTaskClient.getFormattedError(error))));
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

function setEncodedTaskInputs(acrTask: AcrTask, dockerfileOrYaml: string)
{
    acrTask.taskRequestStepType = TaskRequestStepType.EncodedTask;
    acrTask.dockerFile = dockerfileOrYaml;
    acrTask.imageNames = tl.getDelimitedInput("imageNames", "\n");
    acrTask.arguments = tl.getInput("arguments");
}

function setFileTaskAcrTaskInputs(acrTask: AcrTask, dockerfileOrYaml: string)
{
    acrTask.taskRequestStepType = TaskRequestStepType.FileTask;
    acrTask.yamlFile = dockerfileOrYaml;
    acrTask.valuesFilePath = tl.getInput("valuesFilePath");
}

async function run() { 
    try
    {
        var connectedService: string = tl.getInput("connectedServiceName", true);
        const endpoint: AzureEndpoint = await new AzureRMEndpoint(connectedService).getEndpoint();

        //get container registry details
        let azureContainerRegistry = tl.getInput("azureContainerRegistry", true);
        let acrRegistry: ACRRegistry = await utils.getContainerRegistryDetails(endpoint, azureContainerRegistry);

        //populate acr task inputs
        let acrTask = new AcrTask();
        acrTask.name = tl.getVariable('TASK.DISPLAYNAME');
        acrTask.registry = acrRegistry;
        let dockerfileOrYaml = tl.getInput("dockerfileOrYaml", true);

        // check whether dockerfile or yaml
        let path = dockerfileOrYaml.split("/");
        if(!path)
        {
           throw new Error(tl.loc("PathNotSet"));
        }
        else if (path[path.length -1].endsWith(".yaml"))
        {
            // file task step for yaml
            setFileTaskAcrTaskInputs(acrTask, dockerfileOrYaml);
        }
        else
        {
            // encoded task step for dockerfile
            setEncodedTaskInputs(acrTask, dockerfileOrYaml);
        }

        utils.populateContextDetails(acrTask);
        let acrTaskClient = new AcrTaskClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, acrTask);
        await getTask(acrTaskClient);
        var taskId = await createOrUpdateTask(acrTaskClient);

        if(!taskId)
        {
            throw new Error(tl.loc("FailedToExtractFromResponse", "taskId"),)
        }

        var runId = await runTask(taskId, acrTaskClient);
        if(!runId)
        {
            throw new Error(tl.loc("FailedToExtractFromResponse", "runId"),)
        }

        //cancel run on receiving pipeline cancel 
        process.on('SIGINT', () => {
            if(!!runId)
            {
                tl.debug("Cancelling run with runId " + runId);
                cancelRun(runId, acrTaskClient);
            }
        });

        var run = await pollGetRunStatus(runId, acrTaskClient); 
        var loglink = await getlogLink(runId, acrTaskClient);
        if(!loglink)
        {
            throw new Error(tl.loc("FailedToExtractFromResponse", "loglink"),)
        }

        var logfilepath = await toolLib.downloadTool(loglink);
        var readstream =  fs.createReadStream(logfilepath);
        console.log(tl.loc("DownloadedRunLogs"), await utils.streamToString(readstream));
        switch (run.status) {
            case "Succeeded":
                if(!!run.outputImages)
                {
                    var outputImages: OutputImage[] = run.outputImages; 
                    await utils.publishToImageMetadataStore(outputImages);
                }
                tl.setResult(tl.TaskResult.Succeeded, tl.loc("TaskRunSucceeded"));
                break;
            case "Cancelled":
                tl.setResult(tl.TaskResult.Cancelled, tl.loc("TaskRunCancelled"));
                break; 
            default:
                tl.setResult(tl.TaskResult.Failed, tl.loc("TaskRunFailed"));
        }
    }
    catch(exception)
    {
        tl.setResult(tl.TaskResult.Failed, exception);
    }
}

run();