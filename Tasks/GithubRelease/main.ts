import tl = require("vsts-task-lib/task");
import path = require("path");
import { Action, ActionType } from "./operations/Action";
import { Inputs } from "./operations/Utility";

async function run(): Promise<void> {

    try {
        var taskManifestPath = path.join(__dirname, "task.json");
        tl.debug("Setting resource path to " + taskManifestPath);
        tl.setResourcePath(taskManifestPath);        

        const repositoryName = tl.getInput(Inputs.repositoryName) || undefined;        
        const releaseTitle = tl.getInput(Inputs.releaseTitle) || undefined; 
        const isDraft = tl.getBoolInput(Inputs.isDraft) || false;
        const isPrerelease = tl.getBoolInput(Inputs.isPrerelease) || false;
        const action = tl.getInput(Inputs.action);

        if (action === ActionType.create) {
            await Action.createReleaseAction(repositoryName, releaseTitle, isDraft, isPrerelease);
        }
        else if (action === ActionType.edit) {
            await Action.editReleaseAction(repositoryName, releaseTitle, isDraft, isPrerelease);
        }
        else if (action === ActionType.discard) {
            await Action.discardReleaseAction(repositoryName);
        }
    }
    catch(error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

run();
