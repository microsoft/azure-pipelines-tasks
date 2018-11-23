import tl = require("vsts-task-lib/task");
import path = require("path");
import { Action } from "./operations/Action";
import { Inputs, Utility, ActionType, Delimiters} from "./operations/Utility";
import { ChangeLog } from "./operations/ChangeLog";
import { Helper } from "./operations/Helper";

class Main {

    public static async run(): Promise<void> {
        try {
            var taskManifestPath = path.join(__dirname, "task.json");
            tl.debug("Setting resource path to " + taskManifestPath);
            tl.setResourcePath(taskManifestPath);        

            // Get task inputs
            const githubEndpoint = tl.getInput(Inputs.githubEndpoint, true);
            const repositoryName = tl.getInput(Inputs.repositoryName, true);        
            const action = tl.getInput(Inputs.action, true);
            let tag = tl.getInput(Inputs.tag);

            if (action === ActionType.discard) {
                // Get the release id of the release to discard.
                let releaseId: string = await Helper.getReleaseIdForTag(githubEndpoint, repositoryName, tag);

                if (!!releaseId) {
                    await Action.discardReleaseAction(githubEndpoint, repositoryName, releaseId, tag);
                }
                else {
                    throw new Error(tl.loc("NoReleaseFoundToDiscard", tag));
                }
            }
            else {
                // Get task inputs specific to create and edit release
                const target = tl.getInput(Inputs.target, true);
                const releaseTitle = tl.getInput(Inputs.releaseTitle) || undefined; 
                const releaseNotesSelection = tl.getInput(Inputs.releaseNotesSelection);
                const releaseNotesFile = tl.getPathInput(Inputs.releaseNotesFile, false, true);
                const releaseNoteInput = tl.getInput(Inputs.releaseNotesInput);
                const changeLogInput: boolean = tl.getBoolInput(Inputs.changeLog);
                // Generate the change log 
                const changeLog: string = await ChangeLog.getChangeLog(githubEndpoint, repositoryName, target, 250, changeLogInput);
                // Append change log to release note
                const releaseNote: string = Utility.getReleaseNote(releaseNotesSelection, releaseNotesFile, releaseNoteInput, changeLog) || undefined;
                const isPrerelease = tl.getBoolInput(Inputs.isPrerelease) || false;
                const isDraft = tl.getBoolInput(Inputs.isDraft) || false;
                const githubReleaseAssetInputPatterns = tl.getDelimitedInput(Inputs.githubReleaseAsset, Delimiters.newLine);

                if (action === ActionType.create) {
                    // Get tag to create release
                    tag = await Helper.getTagForCreateAction(githubEndpoint, repositoryName, target, tag);

                    if (!tag) {
                        // If no tag found, then give warning and succeeding the task.
                        // Doing this because commits without associated tag will fail continuosly
                        // Other option is to have some task condition, which user can specify in task.
                        console.warn(tl.loc("NoTagFound", target));
                        tl.setResult(tl.TaskResult.Succeeded, "");
                        return;
                    }
                    await Action.createReleaseAction(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns);
                }
                else if (action === ActionType.edit) {
                    // Get the release id of the release to edit.
                    let releaseId: any = await Helper.getReleaseIdForTag(githubEndpoint, repositoryName, tag);

                    // If a release is found, then edit it.
                    // Else create a new release.
                    if (!!releaseId) {
                        await Action.editReleaseAction(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns, releaseId);
                    }
                    else {
                        console.warn(tl.loc("NoReleaseFoundCreateRelease", tag));
                        await Action.createReleaseAction(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns);
                    }
                }
            }
        }
        catch(error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }
    }
}

Main.run();
