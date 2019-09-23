import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import { OutputImage } from "./models/acrtaskrequestbody";
import AcrTaskParameters from "./models/acrtaskparameters"
import AcrTaskOperations from "./operations/acrtaskoperations"
import { TaskUtil, MetadatUtil } from "./utilities/utils";

tl.setResourcePath(path.join(__dirname, 'task.json'));
tl.setResourcePath(path.join( __dirname, 'node_modules/azure-arm-rest-v2/module.json'));

// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

async function run() { 
    try {

        var taskParameters = await new AcrTaskParameters().getAcrTaskParameters();
        var taskOperations = new AcrTaskOperations(taskParameters);
        await taskOperations.populateContextPath();

        //check whether task exists
        await taskOperations.getTask();
        
        var taskId = await taskOperations.createOrUpdateTask();

        if(!taskId)
        {
            throw new Error(tl.loc("FailedToExtractFromResponse", "taskId"))
        }

        var runId = await taskOperations.runTask(taskId);
        if(!runId)
        {
            throw new Error(tl.loc("FailedToExtractFromResponse", "runId"));
        }

        //cancel run on receiving pipeline cancel 
        process.on('SIGINT', () => {
            if(!!runId)
            {
                tl.debug("Cancelling run with runId " + runId);
                taskOperations.cancelRun(runId);
            }
        });

        var run = await taskOperations.pollGetRunStatus(runId); 
        var loglink = await taskOperations.getlogLink(runId);
        if(!loglink)
        {
            throw new Error(tl.loc("FailedToExtractFromResponse", "loglink"));
        }

        await TaskUtil.publishLogs(loglink);

        switch (run.status) {
            case "Succeeded":
                if(!!run.outputImages)
                {
                    var outputImages: OutputImage[] = run.outputImages; 
                    await MetadatUtil.publishToImageMetadataStore(outputImages);
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