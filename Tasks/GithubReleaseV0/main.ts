import tl = require("vsts-task-lib/task");
import path = require("path");
import { Action, ActionType } from "./operations/Action";
import { Inputs, TagSelectionMode, Utility } from "./operations/Utility";
import { Release } from "./operations/Release";

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
            const target = tl.getInput(Inputs.target, true);
            let tag = tl.getInput(Inputs.tag);
            const releaseTitle = tl.getInput(Inputs.releaseTitle) || undefined; 
            const releaseNotesSelection = tl.getInput(Inputs.releaseNotesSelection);
            const releaseNotesFile = tl.getPathInput(Inputs.releaseNotesFile, false, true);
            const releaseNoteInput = tl.getInput(Inputs.releaseNotesInput);
            const releaseNote: string = Utility.getReleaseNote(releaseNotesSelection, releaseNotesFile, releaseNoteInput) || undefined;
            const isPrerelease = tl.getBoolInput(Inputs.isPrerelease) || false;
            const isDraft = tl.getBoolInput(Inputs.isDraft) || false;
            const githubReleaseAssetInput = tl.getInput(Inputs.githubReleaseAsset);

            if (action === ActionType.create) {
                tag = await this._getTagForCreateAction(githubEndpoint, repositoryName, target, tag);
                await Action.createReleaseAction(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInput);
            }
            else if (action === ActionType.edit) {
                let releaseId: any = await this._getReleaseIdForTag(githubEndpoint, repositoryName, tag);

                if (releaseId !== null) {
                    await Action.editReleaseAction(githubEndpoint, repositoryName, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInput, releaseId);
                }
                else {
                    await Action.createReleaseAction(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInput);
                }
            }
            else if (action === ActionType.discard) {
                let releaseId: string = await this._getReleaseIdForTag(githubEndpoint, repositoryName, tag);

                if (releaseId !== null) {
                    await Action.discardReleaseAction(githubEndpoint, repositoryName, releaseId);
                }
                else {
                    throw new Error(tl.loc("NoReleaseFoundToDiscard", tag));
                }
            }
        }
        catch(error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }
    }

    private static async _getTagForCreateAction(githubEndpoint: string, repositoryName: string, target: string, tag: string): Promise<string> {
        let tagSelection = tl.getInput(Inputs.tagSelection);

        if (!!tagSelection && tagSelection === TagSelectionMode.auto) {
            let response = await Release.getBranch(githubEndpoint, repositoryName, target);
            let commit_sha: string = undefined;

            if (response.statusCode === 200) {
                commit_sha = response.body.commit.sha;
            }
            else if (response.statusCode === 404) {
                commit_sha = target;
            }
            else {
                tl.debug("Get branch response:\n" + JSON.stringify(response));
                throw new Error(tl.loc("GetBranchError"));
            }

            let buildSourceVersion = tl.getVariable(this._buildSourceVersion);

            if (commit_sha !== buildSourceVersion) {
                tag = await this._getTagForCommit(githubEndpoint, repositoryName, commit_sha, tag);
            }
            else {
                let buildSourceBranch = tl.getVariable(this._buildSourceBranch);

                let normalizedBranch = Utility.normalizeBranchName(buildSourceBranch);

                if (!!normalizedBranch) {
                    tag = normalizedBranch;
                }
                else {
                    tag = await this._getTagForCommit(githubEndpoint, repositoryName, commit_sha, tag);
                }
            }
        }

        return tag;
    }

    private static async _getTagForCommit(githubEndpoint: string, repositoryName: string, commit_sha: string, tag: string) {
        let tagsResponse = await Release.getTags(githubEndpoint, repositoryName);

        if (tagsResponse.statusCode === 200) {
            let tags: string[] = this._filterTagsForCommit(tagsResponse.body, commit_sha);
            
            if (!!tags && tags.length > 0) {
                tag = tags[0];
            }
            else {
                throw new Error(tl.loc("NoTagFound"));
            }
        }
        else{
            tl.debug("Get tags response:\n" + JSON.stringify(tagsResponse));
            throw new Error(tl.loc("GetTagsError"));
        }

        return tag;
    }

    private static _filterTagsForCommit(tagsList: any[], commit_sha: string) {
        let tags: string[] = [];

        (tagsList || []).forEach((element: any) => {
            if (element.commit.sha === commit_sha) {
                tags.push(element.name);
            }
        });

        return tags;
    }
    
    private static async _getReleaseIdForTag(githubEndpoint: string, repositoryName: string, tag: string): Promise<any> {
        let releasesResponse = await Release.getReleases(githubEndpoint, repositoryName);

        if (releasesResponse.statusCode === 200) {
            let releasesWithGivenTag: any[] = (releasesResponse.body || []).filter(release => release[this._tagNameKey] === tag);

            if (releasesWithGivenTag.length === 0) {
                return null;
            }
            else if (releasesWithGivenTag.length === 1) {
                return releasesWithGivenTag[0][this._idKey];
            }
            else {
                throw new Error(tl.loc("MultipleReleasesFoundError", tag));
            }
        }
        else {
            tl.debug("Get release by tag response:\n" + JSON.stringify(releasesResponse));
            throw new Error(tl.loc("GetReleasesError"));
        }
    }

    private static _buildSourceVersion: string = "Build.SourceVersion";
    private static _buildSourceBranch: string = "Build.SourceBranch";    
    private static readonly _idKey: string = "id";
    private static readonly _tagNameKey: string = "tag_name";
}

Main.run();
