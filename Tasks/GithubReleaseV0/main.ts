import tl = require("vsts-task-lib/task");
import util = require("util");
import path = require("path");
import { Action } from "./operations/Action";
import { Inputs, TagSelectionMode, Utility, GitHubAttributes, AzureDevOpsVariables, ActionType, IGitHubRepositoryInfo, IRepositoryIssueId} from "./operations/Utility";
import { Release } from "./operations/Release";
import { HTTPAttributes } from "./operations/webClient";

interface IRelease {
    tagName: string;
    id: number;
}

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
            const changeLog: string = await this._getChangeLog(githubEndpoint, repositoryName, target);
            const releaseNote: string = Utility.getReleaseNote(releaseNotesSelection, releaseNotesFile, releaseNoteInput, changeLog) || undefined;
            const isPrerelease = tl.getBoolInput(Inputs.isPrerelease) || false;
            const isDraft = tl.getBoolInput(Inputs.isDraft) || false;
            const githubReleaseAssetInputPatterns = tl.getDelimitedInput(Inputs.githubReleaseAsset, '\n');

            // Action
            if (action === ActionType.create) {
                tag = await this._getTagForCreateAction(githubEndpoint, repositoryName, target, tag);
                await Action.createReleaseAction(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns);
            }
            else if (action === ActionType.edit) {
                let releaseId: any = await this._getReleaseIdForTag(githubEndpoint, repositoryName, tag);

                if (releaseId !== null) {
                    await Action.editReleaseAction(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns, releaseId);
                }
                else {
                    await Action.createReleaseAction(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, githubReleaseAssetInputPatterns);
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
            tag = undefined; // Tag should be set to undefined as it can have some value even if tag selection mode is auto.
            let commit_sha: string = await this._getCommitShaFromTarget(githubEndpoint, repositoryName, target);
            let buildSourceVersion = tl.getVariable(AzureDevOpsVariables.buildSourceVersion);

            if (commit_sha !== buildSourceVersion) {
                tag = await this._getTagForCommit(githubEndpoint, repositoryName, commit_sha);
            }
            else {
                let buildSourceBranch = tl.getVariable(AzureDevOpsVariables.buildSourceBranch);
                let normalizedBranch = Utility.normalizeBranchName(buildSourceBranch);

                if (!!normalizedBranch) {
                    tag = normalizedBranch;
                }
                else {
                    tag = await this._getTagForCommit(githubEndpoint, repositoryName, commit_sha);
                }
            }
            return tag;
        }
        else {
            return tag;
        }
    }

    // Returns tag name
    private static async _getTagForCommit(githubEndpoint: string, repositoryName: string, commit_sha: string): Promise<string> {
        tl.debug("_getTagForCommit: ");
        let filteredTag = await this._filterTag(githubEndpoint, repositoryName, commit_sha, this._filterTagsByCommitSha);
        tl.debug("filtered tag _getTagForCommit: " + JSON.stringify(filteredTag));
        return filteredTag && filteredTag[GitHubAttributes.nameAttribute];
    }

    // Returns commit sha
    private static async _getCommitForTag(githubEndpoint: string, repositoryName: string, tag: string): Promise<string> {
        tl.debug("_getCommitForTag");
        let filteredTag = await this._filterTag(githubEndpoint, repositoryName, tag, this._filterTagsByTagName);
        tl.debug("filtered tag: _getCommitForTag" + JSON.stringify(filteredTag));
        return filteredTag && filteredTag[GitHubAttributes.commit][GitHubAttributes.sha];
    }

    // Returns tag object
    private static async _filterTag(githubEndpoint: string, repositoryName: string, filterValue: string, filterTagsCallback: (tagsList: any[], filterValue: string) => any): Promise<any> {
        let tagsResponse = await Release.getTags(githubEndpoint, repositoryName);
        let links: { [key: string]: string } = {};

        while (true) {
            tl.debug("Get tags response:\n" + JSON.stringify(tagsResponse, null, 2));

            if (tagsResponse.statusCode === 200) {
                tl.debug("header link: " + tagsResponse.headers[HTTPAttributes.link])
                links = Utility.parseHTTPHeaderLink(tagsResponse.headers[HTTPAttributes.link]);
                tl.debug("links: " + JSON.stringify(links));
                
                let tag: string = filterTagsCallback(tagsResponse.body, filterValue);
                tl.debug("filteredTag: " + JSON.stringify(tag));

                if (!!tag) {
                    return tag;
                }
                else if (links && links[HTTPAttributes.next]) {
                    let paginatedResponse = await Release.getPaginatedResult(githubEndpoint, links[HTTPAttributes.next]);
                    tagsResponse = paginatedResponse;
                    continue;
                }
                else {
                    throw new Error(tl.loc("NoTagFound"));
                }
            }
            else{
                throw new Error(tl.loc("GetTagsError"));
            }
        }
    }

    private static _filterTagsByCommitSha = (tagsList: any[], commit_sha: string): any => {
        for (let tag of (tagsList || [])) {
            if (tag[GitHubAttributes.commit][GitHubAttributes.sha] === commit_sha) {
                return tag;
            }
        }
        return undefined;
    }

    private static _filterTagsByTagName = (tagsList: any[], tagName: string): any => {
        for (let tag of (tagsList || [])) {
            if (tag[GitHubAttributes.nameAttribute] === tagName) {
                return tag;
            }
        }
        return undefined;
    }
    
    private static async _getReleaseIdForTag(githubEndpoint: string, repositoryName: string, tag: string): Promise<any> {
        let releasesResponse = await Release.getReleases(githubEndpoint, repositoryName);
        let releases: IRelease[] = [];
        let links: { [key: string]: string } = {};

        while (true) {
            tl.debug("Get releases response:\n" + JSON.stringify(releasesResponse, null, 2));

            if (releasesResponse.statusCode === 200) {
                (releasesResponse.body || []).forEach(release => {
                    releases.push({
                        tagName: release[GitHubAttributes.tagName],
                        id: release[GitHubAttributes.id]
                    } as IRelease);
                });

                links = Utility.parseHTTPHeaderLink(releasesResponse.headers[HTTPAttributes.link]);
                tl.debug("links: " + JSON.stringify(links));

                if (links && links[HTTPAttributes.next]) {
                    let paginatedResponse = await Release.getPaginatedResult(githubEndpoint, links[HTTPAttributes.next]);
                    releasesResponse = paginatedResponse;
                    continue;
                }
                else {
                    break;
                }
            }
            else {
                throw new Error(tl.loc("GetReleasesError"));
            }
        }
        let releasesWithGivenTag: any[] = (releases || []).filter((release: IRelease) => release[GitHubAttributes.tagName] === tag);
    
        if (releasesWithGivenTag.length === 0) {
            return null;
        }
        else if (releasesWithGivenTag.length === 1) {
            return releasesWithGivenTag[0][GitHubAttributes.id];
        }
        else {
            throw new Error(tl.loc("MultipleReleasesFoundError", tag));
        }
    }   

    private static _getCommitIdToMessageDictionary(commits: any[]): { [key: string]: string } {
        let commitIdToMessageDictionary: { [key: string]: string } = {};

        for (let commit of (commits || [])) {
            commitIdToMessageDictionary[commit[GitHubAttributes.sha]] = commit[GitHubAttributes.commit][GitHubAttributes.message];
        }

        return commitIdToMessageDictionary;
    }

    private static _extractRepoAndIssueId(repoIssueId: string): IRepositoryIssueId {
        let repoIssueIdInfo: string[] = repoIssueId.split("#");
        let repo: string = repoIssueIdInfo[0];
        let issueId: string = repoIssueIdInfo[1];

        return {
            repository: repo,
            issueId: issueId
        }
    }

    private static async _getChangeLog(githubEndpoint: string, repositoryName: string, target: string): Promise<string> {
        let latestReleaseResponse = await Release.getLatestRelease(githubEndpoint, repositoryName);
        tl.debug("Get latest release response:\n" + JSON.stringify(latestReleaseResponse, null, 2));

        if (latestReleaseResponse.statusCode === 200) {
            let latestReleaseTag: string = latestReleaseResponse.body[GitHubAttributes.tagName];
            tl.debug("latest release tag: " + latestReleaseTag);

            let latestReleaseCommitSha: string = await this._getCommitForTag(githubEndpoint, repositoryName, latestReleaseTag);

            let startCommitSha: string = latestReleaseCommitSha;
            let endCommitSha: string = await this._getCommitShaFromTarget(githubEndpoint, repositoryName, target);

            let commitsListResponse = await Release.getCommitsList(githubEndpoint, repositoryName, startCommitSha, endCommitSha);
            tl.debug("Get commits list response:\n" + JSON.stringify(commitsListResponse, null, 2));

            if (commitsListResponse.statusCode === 200) {
                let commitIdToMessageDictionary: { [key: string]: string } = this._getCommitIdToMessageDictionary(commitsListResponse.body[GitHubAttributes.commits]);
                tl.debug("commitIdToMessageDictionary: " + JSON.stringify(commitIdToMessageDictionary));

                let commitIdToRepoIssueIdsDictionary: { [key: string]: Set<string> } = this._getCommitIdToRepoIssueIdsDictionary(commitIdToMessageDictionary, repositoryName);
                tl.debug("commitIdToRepoIssueIdsDictionary: " + JSON.stringify(commitIdToRepoIssueIdsDictionary));
                
                let uniqueRepoIssueIds: string[] = this._getUniqueRepoIssueIdArray(commitIdToRepoIssueIdsDictionary);
                let issueFragment = "fragment issueInfo on Issue { state }";
                let repositoryTemplate: string = "_%s: repository(owner: %s, name: %s) { _%s: issue(number: %s) { ...issueInfo } }";
                
                // Todo: Refactor to make all issues specific to a repo comes under one repo // Currently it has a separate foreach issue
                // This way repo owner will become unique identifier for repo and this solve problem of unique identfier
                let repoIssueIdsQuery: string = (uniqueRepoIssueIds || []).map((repoIssueId: string) => {
                    let repoIssueIdInfo: IRepositoryIssueId = this._extractRepoAndIssueId(repoIssueId);
                    let repositoryInfo: IGitHubRepositoryInfo = Utility.extractRepositoryOwnerAndName(repoIssueIdInfo.repository);

                    // Assuming owner is unique
                    let uniqueIdentifierForRepoIssueId: string = repositoryInfo.owner + repoIssueIdInfo.issueId;

                    return util.format(repositoryTemplate, uniqueIdentifierForRepoIssueId, repositoryInfo.owner, repositoryInfo.name, repoIssueIdInfo.issueId, repoIssueIdInfo.issueId);                 
                }).join(" ");

                tl.debug("repoIssueIdsQuery: " + repoIssueIdsQuery);
                let query: string = util.format("query { %s }", repoIssueIdsQuery);
                let queryWithFragment: string = util.format("%s %s", query, issueFragment);
                tl.debug("queryWithFragment: " + queryWithFragment);

                let repoIssueIdsResponse = await Release.queryGraphql(githubEndpoint, queryWithFragment);
                tl.debug("Get repoIssueIds response:\n" + JSON.stringify(repoIssueIdsResponse, null, 2));

                if (repoIssueIdsResponse.statusCode === 200) {
                    let reposData = repoIssueIdsResponse.body.data;
                    let changeLog: string = "";

                    Object.keys(commitIdToRepoIssueIdsDictionary).forEach((commitId: string) => {
                        let changeLogPerCommit: string = this._getChangeLogPerCommit(commitId, commitIdToMessageDictionary[commitId], commitIdToRepoIssueIdsDictionary[commitId], reposData, repositoryName);

                        if (changeLogPerCommit) {
                            changeLog += changeLogPerCommit + "\n";
                        }
                    });

                    return changeLog;
                }
                else {
                    throw new Error(tl.loc("GetReposError"));
                }
            }
            else{
                throw new Error(tl.loc("GetCommitsListError"));
            }
        }
        else {
            throw new Error(tl.loc("GetLatestReleaseError"));
        }
    }

    private static _getChangeLogPerCommit(commitId: string, commitMessage: string, repoIssueIdSet: Set<string>, reposData: any, repositoryName: string): string {
        let changeLog: string = commitMessage + " " + commitId; // todo: commit message first line only
        
        if (!!repoIssueIdSet && repoIssueIdSet.size > 0) {
            changeLog += ","; // todo check if returned data is valid or not

            (repoIssueIdSet).forEach((repoIssueId: string) => {
                let repoIssueIdInfo: IRepositoryIssueId = this._extractRepoAndIssueId(repoIssueId);
                let repoInfo: IGitHubRepositoryInfo = Utility.extractRepositoryOwnerAndName(repoIssueIdInfo.repository);
                let uniqueIdentifierForRepoIssueId: string = repoInfo.owner + repoIssueIdInfo.issueId; //Todo: Need to find unique attribute
                let issueId: string = repoIssueIdInfo.issueId;

                tl.debug("uniqueIdentifierForRepoIssueId: " + uniqueIdentifierForRepoIssueId);
                tl.debug("issueId: " + issueId);

                if (!!reposData["_" + uniqueIdentifierForRepoIssueId] && !!reposData["_" + uniqueIdentifierForRepoIssueId]["_" + issueId]) {
                    changeLog += " ";
                    if (repoIssueIdInfo.repository !== repositoryName) {
                        changeLog += repoIssueIdInfo.repository;
                    }
                    changeLog = changeLog + "#" + issueId ;
                }
            });
    
        }

        return changeLog;
    }

    private static _getUniqueRepoIssueIdArray(commitIdToRepoIssueIdsDictionary: { [key: string]: Set<string> }): string[] {
        let uniqueRepoIssueIdSet: Set<string> = new Set();

        Object.keys(commitIdToRepoIssueIdsDictionary).forEach((commitId: string) => {
            let repoIssueIdSet: Set<string> = commitIdToRepoIssueIdsDictionary[commitId];

            if (repoIssueIdSet && repoIssueIdSet.size > 0) {
                (repoIssueIdSet).forEach((repoIssueId: string) => {
                    if (!uniqueRepoIssueIdSet.has(repoIssueId)) {
                        uniqueRepoIssueIdSet.add(repoIssueId);
                    }
                });
            }
        });

        return Array.from(uniqueRepoIssueIdSet);
    }

    private static _getCommitIdToRepoIssueIdsDictionary(commitIdToMessageDictionary: { [key: string]: string }, repositoryName: string): { [key: string]: Set<string> } {
        let commitIdToRepoIssueIdsDictionary: { [key: string]: Set<string> } = {};

        Object.keys(commitIdToMessageDictionary).forEach((commitId: string) => {
            commitIdToRepoIssueIdsDictionary[commitId] = this._getRepoIssueIdSetFromCommitMessage(commitIdToMessageDictionary[commitId], repositoryName);

        });

        return commitIdToRepoIssueIdsDictionary;
    }

    private static _getRepoIssueIdSetFromCommitMessage(message: string, repositoryName: string): Set<string> {
        // https://github.com/moby/moby/commit/df23a1e675c7e3cbad617374d85c48103541ee14?short_path=6206c94#diff-6206c94cde21ec0a5563c8369b71e609
        let issueRegex = new RegExp("(?:^|[^A-Za-z0-9_]?)([a-z0-9_]+/[a-zA-Z0-9-_.]+)?(?:#|[G|g][H|h]-)([0-9]+)(?:[^A-Za-z_]|$)", "gm");
        let match = undefined;
        let repoIssueIdSet: Set<string> = new Set();

        while (match = issueRegex.exec(message)) {
            tl.debug("match: " + match);
            tl.debug("match1: " + match[1]);
            tl.debug("match2: " + match[2]);
            tl.debug("repositoryName: " + repositoryName);

            let repo: string = match[1] ? match[1] : repositoryName;
            let issueId: string = match[2];

            if (parseInt(issueId)) {
                let uniqueRepoIssueId: string = repo + "#" + issueId;
                tl.debug("uniqueRepoIssueId: " + uniqueRepoIssueId);
                if (!repoIssueIdSet.has(uniqueRepoIssueId)) {
                    tl.debug("uniqueRepoIssueId true: " + uniqueRepoIssueId);

                    repoIssueIdSet.add(uniqueRepoIssueId);
                }
                else {
                    tl.debug("uniqueRepoIssueId false: " + uniqueRepoIssueId);
                }
            }
            else {
                tl.debug("parse error issued");
            }
        }
        tl.debug("match: " + match);
        tl.debug("leaving: " + repoIssueIdSet);
        return repoIssueIdSet;
    }


    // Returns latest commit on the target if target is branch else returns target.
    private static async _getCommitShaFromTarget(githubEndpoint: string, repositoryName: string, target: string): Promise<string> {
        let response = await Release.getBranch(githubEndpoint, repositoryName, target);
        tl.debug("Get branch response:\n" + JSON.stringify(response, null, 2));
        let commit_sha: string = undefined;

        if (response.statusCode === 200) {
            commit_sha = response.body[GitHubAttributes.commit][GitHubAttributes.sha];
        }
        else if (response.statusCode === 404) {
            commit_sha = target;
        }
        else {
            throw new Error(tl.loc("GetBranchError"));
        }

        return commit_sha;
    }

}

Main.run();
