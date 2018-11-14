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

            let tag = tl.getInput(Inputs.tag);
            const target = tl.getInput(Inputs.target) || undefined;
            const repositoryName = tl.getInput(Inputs.repositoryName, true) || undefined;        
            const releaseTitle = tl.getInput(Inputs.releaseTitle) || undefined; 
            const isDraft = tl.getBoolInput(Inputs.isDraft) || false;
            const isPrerelease = tl.getBoolInput(Inputs.isPrerelease) || false;
            const action = tl.getInput(Inputs.action);

            if (action === ActionType.create) {
                tag = await this._getTagForCreateAction(tag, repositoryName, target);
                await Action.createReleaseAction(repositoryName, tag, target, releaseTitle, isDraft, isPrerelease);
            }
            else if (action === ActionType.edit) {
                await Action.editReleaseAction(repositoryName, tag, releaseTitle, isDraft, isPrerelease);
            }
            else if (action === ActionType.discard) {
                await Action.discardReleaseAction(repositoryName, tag);
            }
        }
        catch(error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }
    }

    private static async _getTagForCreateAction(tag: string, repositoryName: string, target: string): Promise<string> {
        let tagSelection = tl.getInput(Inputs.tagSelection);

        if (!!tagSelection && tagSelection === TagSelectionMode.auto) {
            let response = await Release.getBranch(repositoryName, target);
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
                tag = await this._getTagForCommit(repositoryName, commit_sha, tag);
            }
            else {
                let buildSourceBranch = tl.getVariable(this._buildSourceBranch);

                let normalizedBranch = Utility.normalizeBranchName(buildSourceBranch);

                if (!!normalizedBranch) {
                    tag = normalizedBranch;
                }
                else {
                    tag = await this._getTagForCommit(repositoryName, commit_sha, tag);
                }
            }
        }

        return tag;
    }

    private static async _getTagForCommit(repositoryName: string, commit_sha: string, tag: string) {
        let tagsResponse = await Release.getTags(repositoryName);

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

    private static _filterTagsForCommit(tagsList: any, commit_sha: string) {
        let tags: string[] = [];

        (tagsList || []).forEach((element: any) => {
            if (element.commit.sha === commit_sha) {
                tags.push(element.name);
            }
        });

        return tags;
    }

    private static _buildSourceVersion: string = "Build.SourceVersion";
    private static _buildSourceBranch: string = "Build.SourceBranch";
}

Main.run();
