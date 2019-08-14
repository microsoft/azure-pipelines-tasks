import tl = require("azure-pipelines-task-lib/task");
import path = require("path");
import { Action } from "./operations/Action";
import { Utility, ActionType, Delimiters, ChangeLogStartCommit, ChangeLogType } from './operations/Utility';
import { Inputs} from "./operations/Constants";
import { ChangeLog } from "./operations/ChangeLog";
import { Helper } from "./operations/Helper";

class Main {

    public static async run(): Promise<void> {
        try {
            var taskManifestPath = path.join(__dirname, "task.json");
            tl.debug("Setting resource path to " + taskManifestPath);
            tl.setResourcePath(taskManifestPath);    

            let actions = new Action();
            let helper = new Helper()

            // Get basic task inputs
            const githubEndpoint = tl.getInput(Inputs.gitHubConnection, true);
            const githubEndpointToken = Utility.getGithubEndPointToken(githubEndpoint);

            const repositoryName = tl.getInput(Inputs.repositoryName, true);    

            const action = tl.getInput(Inputs.action, true).toLowerCase();
            Utility.validateAction(action);

            let tagSource = tl.getInput(Inputs.tagSource);
            Utility.validateTagSource(tagSource, action);
            
            let tag = tl.getInput(Inputs.tag);
            Utility.validateTag(tag, tagSource, action);

            if (action === ActionType.delete) {
                helper.publishTelemetry();
                await actions.deleteReleaseAction(githubEndpointToken, repositoryName, tag);
            }
            else {
                // Get task inputs specific to create and edit release
                const target = tl.getInput(Inputs.target, true);
                const releaseTitle = tl.getInput(Inputs.title) || undefined;

                const isPrerelease = tl.getBoolInput(Inputs.isPreRelease) || false;
                const isDraft = tl.getBoolInput(Inputs.isDraft) || false;
                const githubReleaseAssetInputPatterns = tl.getDelimitedInput(Inputs.assets, Delimiters.newLine);

                if (action === ActionType.create) {
                    //Get task inputs specific to create release
                    const tagPattern = tl.getInput(Inputs.tagPattern) || undefined;

                    // Get tag to create release if tag source is gitTag/auto
                    if (Utility.isTagSourceAuto(tagSource)) {
                        tag = await helper.getTagForCommitTarget(githubEndpointToken, repositoryName, target, tagPattern);
                    }

                    if (!!tag) {
                        helper.publishTelemetry();
                        const releaseNote: string = await this._getReleaseNote(githubEndpointToken, repositoryName, target);
                        await actions.createReleaseAction(githubEndpointToken, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns);
                    }
                    else {
                        // If no tag found, then give warning.
                        // Doing this because commits without associated tag will fail continuosly if we throw error.
                        // Other option is to have some task condition, which user can specify in task.
                        tl.warning(tl.loc("NoTagFound"));
                        tl.debug("No tag found"); // for purpose of L0 test only.
                    }
                }
                else if (action === ActionType.edit) {
                    helper.publishTelemetry();
                    const releaseNote: string = await this._getReleaseNote(githubEndpointToken, repositoryName, target);
                    // Get the release id of the release to edit.
                    console.log(tl.loc("FetchReleaseForTag", tag));
                    let releaseId: any = await helper.getReleaseIdForTag(githubEndpointToken, repositoryName, tag);

                    // If a release is found, then edit it.
                    // Else create a new release.
                    if (!!releaseId) {
                        console.log(tl.loc("FetchReleaseForTagSuccess", tag));
                        await actions.editReleaseAction(githubEndpointToken, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns, releaseId);
                    }
                    else {
                        tl.warning(tl.loc("NoReleaseFoundToEditCreateRelease", tag));
                        await actions.createReleaseAction(githubEndpointToken, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns);
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
        const releaseNotesSource = tl.getInput(Inputs.releaseNotesSource, true);
        Utility.validateReleaseNotesSource(releaseNotesSource);
        const releaseNotesFile = tl.getPathInput(Inputs.releaseNotesFile, false, true);
        const releaseNoteInput = tl.getInput(Inputs.releaseNotes);
        const showChangeLog: boolean = tl.getBoolInput(Inputs.addChangeLog);
        let changeLog: string = "";
        if (showChangeLog){
            let changeLogLabels: any = null;
            const changeLogCompareToRelease = tl.getInput(Inputs.changeLogCompareToRelease);
            Utility.validateStartCommitSpecification(changeLogCompareToRelease);
            const changeLogType = tl.getInput(Inputs.changeLogType);
            Utility.validateChangeLogType(changeLogType);
            if (changeLogType === ChangeLogType.issueBased){
                const changeLogLabelsInput = tl.getInput(Inputs.changeLogLabels);
                try{
                    changeLogLabels = JSON.parse(changeLogLabelsInput);
                }
                catch(error){
                    changeLogLabels = [];
                    tl.warning(tl.loc("LabelsSyntaxError"));
                }
            }

            const changeLogCompareToReleaseTag = tl.getInput(Inputs.changeLogCompareToReleaseTag) || undefined;
            // Generate the change log 
            // Get change log for top 250 commits only
            changeLog = await new ChangeLog().getChangeLog(githubEndpointToken, repositoryName, target, 250, ChangeLogStartCommit[changeLogCompareToRelease], changeLogType, changeLogCompareToReleaseTag, changeLogLabels);
        }
        // Append change log to release note
        const releaseNote: string = Utility.getReleaseNote(releaseNotesSource, releaseNotesFile, releaseNoteInput, changeLog) || undefined;

        return releaseNote;
    }
}

Main.run();
