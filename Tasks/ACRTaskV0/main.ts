import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import { OutputImage, TaskRequestStepType } from "./models/acrtaskrequestbody";
import AcrTaskParameters from "./models/acrtaskparameters"
import AcrTaskOperations from "./operations/acrtaskoperations"
import { TaskUtil, MetadatUtil } from "./utilities/utils";

tl.setResourcePath(path.join(__dirname, 'task.json'));
tl.setResourcePath(path.join( __dirname, 'node_modules/azure-pipelines-tasks-azure-arm-rest-v2/module.json'));

// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

async function run() { 
    try {

        var taskParameters = await new AcrTaskParameters().getAcrTaskParameters();
        var taskOperations = new AcrTaskOperations(taskParameters);

        if (taskOperations.acrTaskClient.acrTask.contextType == "file")
        {
            console.log("Populating context path");
            await taskOperations.populateContextPath();
        }

        //check whether task exists
        var taskVersion = await taskOperations.getTask();

        taskOperations.acrTaskClient.acrTask.version = taskVersion
        var taskId = await taskOperations.createOrUpdateTask();

        if(!taskId)
        {
            throw new Error(tl.loc("FailedToExtractFromResponse", "taskId"))
        }

        var runId = "";

        //cancel run on receiving pipeline cancel 
        process.on('SIGINT', () => {
            if(!!runId)
            {
                tl.debug("Cancelling run with runId " + runId);
                taskOperations.cancelRun(runId);
            }
        });

        runId = await taskOperations.runTask(taskId);
        if(!runId)
        {
            throw new Error(tl.loc("FailedToExtractFromResponse", "runId"));
        }

        
        var run = await taskOperations.pollGetRunStatus(runId); 
        var loglink = await taskOperations.getlogLink(runId);
        if(!!loglink)
        {
            await TaskUtil.publishLogs(loglink);
        }
        else
        {
            tl.warning(tl.loc("FailedToExtractFromResponse", "loglink"));
        }

        switch (run.status) {
            case "Succeeded":
                try {
                    if(!!run.outputImages)
                    {
                        var outputImages: OutputImage[] = run.outputImages; 
                        var sourceContextPath = tl.getInput("contextPath", true);
                        var acrTask = taskOperations.acrTaskClient.acrTask
                        var dockerFilePath = acrTask.taskRequestStepType == TaskRequestStepType.EncodedTask? sourceContextPath.concat(acrTask.dockerFile) : "";
                        await MetadatUtil.publishToImageMetadataStore(outputImages, dockerFilePath);
                    }
                }
                catch(err) {
                    console.log("Unable to push pipeline metadata")
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