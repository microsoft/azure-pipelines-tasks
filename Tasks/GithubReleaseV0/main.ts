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

            // Get basic task inputs
            const githubEndpoint = tl.getInput(Inputs.gitHubConnection, true);
            const githubEndpointToken = Utility.getGithubEndPointToken(githubEndpoint);
            const repositoryName = tl.getInput(Inputs.repositoryName, true);        
            const action = tl.getInput(Inputs.action, true);
            let tag = tl.getInput(Inputs.tag);

            if (action === ActionType.discard) {
                await Action.discardReleaseAction(githubEndpointToken, repositoryName, tag);
            }
            else {
                // Get task inputs specific to create and edit release
                const target = tl.getInput(Inputs.target, true);
                const releaseTitle = tl.getInput(Inputs.title) || undefined; 

                const isPrerelease = tl.getBoolInput(Inputs.isPreRelease) || false;
                const isDraft = tl.getBoolInput(Inputs.isDraft) || false;
                const githubReleaseAssetInputPatterns = tl.getDelimitedInput(Inputs.assets, Delimiters.newLine);

                if (action === ActionType.create) {
                    // Get tag to create release
                    tag = await Helper.getTagForCreateAction(githubEndpointToken, repositoryName, target, tag);

                    if (!!tag) {
                        const releaseNote: string = await this._getReleaseNote(githubEndpointToken, repositoryName, target);
                        await Action.createReleaseAction(githubEndpointToken, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns);
                    }
                    else {
                        // If no tag found, then give warning.
                        // Doing this because commits without associated tag will fail continuosly if we throw error.
                        // Other option is to have some task condition, which user can specify in task.
                        tl.warning(tl.loc("NoTagFound", target));
                    }
                }
                else if (action === ActionType.edit) {
                    const releaseNote: string = await this._getReleaseNote(githubEndpointToken, repositoryName, target);
                    // Get the release id of the release to edit.
                    console.log(tl.loc("FetchReleaseForTag", tag));
                    let releaseId: any = await Helper.getReleaseIdForTag(githubEndpointToken, repositoryName, tag);

                    // If a release is found, then edit it.
                    // Else create a new release.
                    if (!!releaseId) {
                        console.log(tl.loc("FetchReleaseForTagSuccess", tag));
                        await Action.editReleaseAction(githubEndpointToken, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns, releaseId);
                    }
                    else {
                        tl.warning(tl.loc("NoReleaseFoundToEditCreateRelease", tag));
                        await Action.createReleaseAction(githubEndpointToken, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns);
                    }
                }
            }

            tl.setResult(tl.TaskResult.Succeeded, "");
        }
        catch(error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }
    }

    private static async _getReleaseNote(githubEndpointToken: string, repositoryName: string, target: string): Promise<string> {
        const releaseNotesSelection = tl.getInput(Inputs.releaseNotesSource);
        const releaseNotesFile = tl.getPathInput(Inputs.releaseNotesFile, false, true);
        const releaseNoteInput = tl.getInput(Inputs.releaseNotes);
        const showChangeLog: boolean = tl.getBoolInput(Inputs.addChangeLog);

        // Generate the change log 
        // Get change log for top 250 commits only
        const changeLog: string = showChangeLog ? await ChangeLog.getChangeLog(githubEndpointToken, repositoryName, target, 250) : "";

        // Append change log to release note
        const releaseNote: string = Utility.getReleaseNote(releaseNotesSelection, releaseNotesFile, releaseNoteInput, changeLog) || undefined;

        return releaseNote;
    }
}

Main.run();
