import tl = require("vsts-task-lib/task");
import path = require("path");
import { Action } from "./operations/Action";
import { Inputs } from "./operations/Utility";

async function run(): Promise<void> {

    try {
        var taskManifestPath = path.join(__dirname, "task.json");
        tl.debug("Setting resource path to " + taskManifestPath);
        tl.setResourcePath(taskManifestPath);        

        const repositoryName = tl.getInput(Inputs.repositoryName);        
        const releaseTitle = tl.getInput(Inputs.releaseTitle);      
        const isDraft = tl.getBoolInput(Inputs.isdraft);
        const isPrerelease = tl.getBoolInput(Inputs.isprerelease);

        let action = tl.getInput(Inputs.action);

        if (action === "Create") {
            await Action.createReleaseAction(repositoryName, releaseTitle, isDraft, isPrerelease);
        }
        else if (action === "Edit") {
            await Action.editReleaseAction(repositoryName, releaseTitle, isDraft, isPrerelease);
        }
        else if (action === "Discard") {
            await Action.discardReleaseAction(repositoryName);
        }
    }
    catch(error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

run();
