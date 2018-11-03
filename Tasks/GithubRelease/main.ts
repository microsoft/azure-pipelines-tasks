import tl = require("vsts-task-lib/task");
import path = require("path");
import { createReleaseAction, editReleaseAction, discardReleaseAction } from "./operations/Action";

async function run(): Promise<void> {

    try {
        var taskManifestPath = path.join(__dirname, "task.json");
        tl.debug("Setting resource path to " + taskManifestPath);
        tl.setResourcePath(taskManifestPath);        

        let action = tl.getInput("action");
        tl.debug("Github action = " + action);

        if (action === "Create") {
            await createReleaseAction();
        }
        else if (action === "Edit") {
            await editReleaseAction();
        }
        else if (action === "Discard") {
            await discardReleaseAction();
        }
    }
    catch(error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

run();
