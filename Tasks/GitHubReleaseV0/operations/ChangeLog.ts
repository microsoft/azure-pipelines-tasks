import tl = require("vsts-task-lib/task");
import util = require("util");
import {Utility, GitHubAttributes, IRepositoryIssueId, Delimiters, AzureDevOpsVariables} from "./Utility";
import { Release } from "./Release";
import { Helper } from "./Helper";

export class ChangeLog {

    /**
     * Returns the change log.
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param target 
     * @param top 
     * @param changeLogInput 
     */
    public async getChangeLog(githubEndpointToken: string, repositoryName: string, target: string, top: number): Promise<string> {
        console.log(tl.loc("ComputingChangeLog"));

        let release = new Release();

        // Get the latest published release to compare the changes with.
        console.log(tl.loc("FetchLatestPublishRelease"));
        let latestReleaseResponse = await release.getLatestRelease(githubEndpointToken, repositoryName);
        tl.debug("Get latest release response: " + JSON.stringify(latestReleaseResponse));

        // We will be fetching changes between startCommitSha...endCommitSha.
        // endCommitSha: It is the current commit
        // startCommitSha: It is the commit for which previous release was created
        // If no previous release found, then it will be the first commit.
        let startCommitSha: string;
        
        // If repository has 0 releases, then latest release api returns 404.
        if (latestReleaseResponse.statusCode === 200 || latestReleaseResponse.statusCode === 404) {
            // Get the curent commit.
            let endCommitSha: string = await new Helper().getCommitShaFromTarget(githubEndpointToken, repositoryName, target);

            // Get the start commit.
            // Release has target_commitsh property but it can be branch name also.
            // Hence if a release is present, then get the tag and find its corresponding commit.
            // Else get the first commit.
            if (latestReleaseResponse.statusCode !== 404 && latestReleaseResponse.body && !!latestReleaseResponse.body[GitHubAttributes.tagName]) {
                let latestReleaseTag: string = latestReleaseResponse.body[GitHubAttributes.tagName];
                tl.debug("latest release tag: " + latestReleaseTag);
                
                let latestReleaseUrl: string = latestReleaseResponse.body[GitHubAttributes.htmlUrl];
                console.log(tl.loc("FetchLatestPublishReleaseSuccess", latestReleaseUrl));
                startCommitSha = await this._getCommitForTag(githubEndpointToken, repositoryName, latestReleaseTag);
            }
            else {
                console.log(tl.loc("NoLatestPublishRelease"));
                console.log(tl.loc("FetchInitialCommit"));
                startCommitSha = await this._getInitialCommit(githubEndpointToken, repositoryName, endCommitSha, top);
                console.log(tl.loc("FetchInitialCommitSuccess", startCommitSha));
            }
            
            // Compare the diff between 2 commits.
            console.log(tl.loc("FetchCommitDiff"));
            let commitsListResponse = await release.getCommitsList(githubEndpointToken, repositoryName, startCommitSha, endCommitSha);
            tl.debug("Get commits list response: " + JSON.stringify(commitsListResponse));

            if (commitsListResponse.statusCode === 200) {
                // If end commit is older than start commit i.e. Rollback scenario, we will not show any change log.
                if (commitsListResponse.body[GitHubAttributes.status] === GitHubAttributes.behind) {
                    tl.warning(tl.loc("CommitDiffBehind"));
                    return "";
                }
                else {
                    let commits: any[] = commitsListResponse.body[GitHubAttributes.commits] || [];

                    // If endCommit and startCommit are same then also we will not show any change log.
                    if (commits.length === 0) {
                        console.log(tl.loc("CommitDiffEqual"));
                        return "";
                    }

                    console.log(tl.loc("FetchCommitDiffSuccess"));
                    // Reversing commits as commits retrieved are in oldest first order
                    commits = commits.reverse(); 

                    // Only show changeLog for top X commits, where X = top
                    // Form the commitId to issues dictionary
                    let commitIdToMessageDictionary: { [key: string]: string } = this._getCommitIdToMessageDictionary(commits.length > top ? commits.slice(0, top) : commits);
                    tl.debug("commitIdToMessageDictionary: " + JSON.stringify(commitIdToMessageDictionary));
    
                    let commitIdToRepoIssueIdsDictionary: { [key: string]: Set<string> } = this._getCommitIdToRepoIssueIdsDictionary(commitIdToMessageDictionary, repositoryName);
                    tl.debug("commitIdToRepoIssueIdsDictionary: " + JSON.stringify(commitIdToRepoIssueIdsDictionary));
                    
                    let changeLog: string = "";
                    let topXChangeLog: string = ""; // where 'X' is the this._changeLogVisibleLimit.
                    let seeMoreChangeLog: string = "";
    
                    // Evaluate change log
                    Object.keys(commitIdToRepoIssueIdsDictionary).forEach((commitId: string, index: number) => {
                        let changeLogPerCommit: string = this._getChangeLogPerCommit(commitId, commitIdToMessageDictionary[commitId], commitIdToRepoIssueIdsDictionary[commitId], repositoryName);
    
                        // If changes are more than 10, then we will show See more button which will be collapsible.
                        // And under that seeMoreChangeLog will be shown
                        // topXChangeLog will be visible to user.
                        if (index >= this._changeLogVisibleLimit) {
                            seeMoreChangeLog = seeMoreChangeLog + changeLogPerCommit + Delimiters.newLine;
                        }
                        else {
                            topXChangeLog = topXChangeLog + changeLogPerCommit + Delimiters.newLine;
                        }
                    });
    
                    if (topXChangeLog) {
                        changeLog = this._ChangeLogTitle + topXChangeLog;

                        if(!seeMoreChangeLog) {
                            changeLog = changeLog + Delimiters.newLine + this._getAutoGeneratedText();
                        }
                        else {
                            changeLog = changeLog + util.format(this._seeMoreChangeLogFormat, this._seeMoreText, seeMoreChangeLog, this._getAutoGeneratedText());
                        }
                    }

                    console.log(tl.loc("ComputingChangeLogSuccess"));
                    return changeLog;
                }
            }
            else{
                tl.error(tl.loc("FetchCommitDiffError"));
                throw new Error(commitsListResponse.body[GitHubAttributes.message]);
            }
        }
        else {
            tl.error(tl.loc("GetLatestReleaseError"));
            throw new Error(latestReleaseResponse.body[GitHubAttributes.message]);
        }
    }


    /**
     * Returns the commit for provided tag
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param tag 
     */
    private async _getCommitForTag(githubEndpointToken: string, repositoryName: string, tag: string): Promise<string> {
        let filteredTag: any = await new Helper().filterTag(githubEndpointToken, repositoryName, tag, this._filterTagsByTagName);

        return filteredTag && filteredTag[GitHubAttributes.commit][GitHubAttributes.sha];
    }

    /**
     * Returns a commit which is 'X' (top) commits older than the provided commit sha.
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param sha 
     */
    private async _getInitialCommit(githubEndpointToken: string, repositoryName: string, sha: string, top: number): Promise<string> {
        let release = new Release();

        // No api available to get first commit directly.
        // So, fetching all commits before the current commit sha.
        // Returning last commit or 250th commit which ever is smaller.
        let commitsForGivenShaResponse = await release.getCommitsBeforeGivenSha(githubEndpointToken, repositoryName, sha);
        let links: { [key: string]: string } = {};
        let commits: any[] = [];

        while(true) {
            tl.debug("Get initial commit response: " + JSON.stringify(commitsForGivenShaResponse));

            if (commitsForGivenShaResponse.statusCode === 200) {
                // Returned commits are in latest first order and first commit is the commit queried itself.
                (commitsForGivenShaResponse.body || []).forEach(commit => {
                    commits.push(commit);
                });
    
                if (commits.length >= top) {
                    // Return 250th commit
                    return commits[top - 1][GitHubAttributes.sha];
                }

                links = Utility.parseHTTPHeaderLink(commitsForGivenShaResponse.headers[GitHubAttributes.link]);

                // Calling the next page if it exists
                if (links && links[GitHubAttributes.next]) {
                    let paginatedResponse = await release.getPaginatedResult(githubEndpointToken, links[GitHubAttributes.next]);
                    commitsForGivenShaResponse = paginatedResponse;
                    continue;
                }
                else {
                    // Return last commit.
                    return commits[commits.length - 1][GitHubAttributes.sha];
                }
            }
            else {
                tl.error(tl.loc("FetchInitialCommitError"));
                throw new Error(commitsForGivenShaResponse.body[GitHubAttributes.message]);
            }
        }
    }

    /**
     * Returns a dictionary of { commitId to commit message }.
     * @param commits 
     */
    private _getCommitIdToMessageDictionary(commits: any[]): { [key: string]: string } {
        let commitIdToMessageDictionary: { [key: string]: string } = {};

        for (let commit of (commits || [])) {
            commitIdToMessageDictionary[commit[GitHubAttributes.sha]] = commit[GitHubAttributes.commit][GitHubAttributes.message];
        }

        return commitIdToMessageDictionary;
    }

    /**
     * Returns a dictionary of { commitId to repoIssueIds }.
     * @param commitIdToMessageDictionary 
     * @param repositoryName 
     */
    private _getCommitIdToRepoIssueIdsDictionary(commitIdToMessageDictionary: { [key: string]: string }, repositoryName: string): { [key: string]: Set<string> } {
        let commitIdToRepoIssueIdsDictionary: { [key: string]: Set<string> } = {};

        Object.keys(commitIdToMessageDictionary).forEach((commitId: string) => {
            commitIdToRepoIssueIdsDictionary[commitId] = this._getRepoIssueIdFromCommitMessage(commitIdToMessageDictionary[commitId], repositoryName);

        });

        return commitIdToRepoIssueIdsDictionary;
    }

    /**
     * Filter tags by tag name.
     * Returns tag object.
     */
    private _filterTagsByTagName = (tagsList: any[], tagName: string): any[] => {
        let filteredTags: any[] = [];

        (tagsList || []).forEach((tag: any) => {
            if (tag[GitHubAttributes.nameAttribute] === tagName) {
                filteredTags.push(tag);
            }
        });

        return filteredTags;
    }

    /**
     * Returns a unique set of repository#issueId string for each issue mentioned in the commit.
     * repository#issueId string is needed as issues can be of cross repository.
     * @param message 
     * @param repositoryName 
     */
    private _getRepoIssueIdFromCommitMessage(message: string, repositoryName: string): Set<string> {
        let match = undefined;
        let repoIssueIdSet: Set<string> = new Set();

        // regex.exec(message) will return one match at a time.
        // Multiple execution will yield all matches.
        // Returns undefined if no further match found.
        // match is an array, where match[0] is the complete match
        // and other match[i] gives the captured strings in order.
        // In our regex, we have captured repository name and issueId resp.
        while (match = this._issueRegex.exec(message)) {
            tl.debug("match: " + match[0]);
            tl.debug("match1: " + match[1]);
            tl.debug("match2: " + match[2]);
            tl.debug("repositoryName: " + repositoryName);

            // If no repository name found before an issue, then use user provided repository name to link it to issue
            let repo: string = match[1] ? match[1] : repositoryName;
            let issueId: string = match[2];

            // Using # as separator as neither repoName nor issueId will have #.
            let uniqueRepoIssueId: string = repo + Delimiters.hash + issueId;
            tl.debug("uniqueRepoIssueId: " + uniqueRepoIssueId);

            // Message can contain same issue linked multiple times.
            // Do not add an issue if its already added.
            if (!repoIssueIdSet.has(uniqueRepoIssueId)) {
                repoIssueIdSet.add(uniqueRepoIssueId);
            }
        }

        return repoIssueIdSet;
    }

    /**
     * Returns the log for a single commit.
     * Log format: * commitId commitMessageTitle, [ #issueId1, #issueId2 ]
     * @param commitId 
     * @param commitMessage 
     * @param repoIssueIdSet 
     * @param repositoryName 
     */
    private _getChangeLogPerCommit(commitId: string, commitMessage: string, repoIssueIdSet: Set<string>, repositoryName: string): string {
        // GitHub commit messages have description as well alongwith title.
        // Parsing the commit title and showing to user.
        let commitMessageFirstLine: string = Utility.getFirstLine(commitMessage);
        // Log format without issues: * commitId commitMessageTitle
        let log: string = Delimiters.star + Delimiters.space + commitId + Delimiters.space + commitMessageFirstLine;
        let issuesText: string = "";

        // Appending each issue mentioned in the commit message.
        // Ignoring issue which is present in commit title, to avoid duplicates.
        if (!!repoIssueIdSet && repoIssueIdSet.size > 0) {

            (repoIssueIdSet).forEach((repoIssueId: string) => {
                // Extract repository information for issue as cross repository issues can also be present.
                let repoIssueIdInfo: IRepositoryIssueId = Utility.extractRepoAndIssueId(repoIssueId);
                let issueIdText: string = "";

                // If issue belongs to cross repository, then prefix repository name to issueId so that it can be linked correctly in GitHub.
                if (repoIssueIdInfo.repository !== repositoryName) {
                    issueIdText += repoIssueIdInfo.repository;
                }
                // # is required before issueId for referencing purpose in GitHub.
                issueIdText = issueIdText + Delimiters.hash + repoIssueIdInfo.issueId;

                // If this issue is not present in commit title, then append to issues text.
                if (!commitMessageFirstLine.includes(issueIdText)) {
                    if (!!issuesText) {
                        // Append comma after every issue
                        issuesText += Delimiters.comma;
                    }
                    issuesText = issuesText + Delimiters.space + issueIdText;
                }
            });
        }

        // If issues are present, then enclose it in brackets and append to log.
        if (!!issuesText) {
            log = log + Delimiters.openingBracketWithSpace + issuesText + Delimiters.closingBracketWithSpace;
        }

        return log;
    }

    private _getAutoGeneratedText(): string {
        let autoGeneratedUrl: string = this._getAutoGeneratedUrl();

        if (!!autoGeneratedUrl) {
            return util.format(this._autoGeneratedTextFormat, autoGeneratedUrl);
        }

        return "";
    }

    private _getAutoGeneratedUrl(): string {
        let releaseUrl: string = tl.getVariable(AzureDevOpsVariables.releaseWebUrl);

        if (!!releaseUrl) {
            tl.debug("release web url: " + releaseUrl);
            return releaseUrl;
        }
        else {
            let collectionUri: string = tl.getVariable(AzureDevOpsVariables.collectionUri);

            // Make sure collection uri does not end with slash
            if (collectionUri.endsWith(Delimiters.slash)) {
                collectionUri = collectionUri.slice(0, collectionUri.length - 1);
            }
            
            let teamProject: string = tl.getVariable(AzureDevOpsVariables.teamProject);
            let buildId: string = tl.getVariable(AzureDevOpsVariables.buildId);

            tl.debug("Build url: " + util.format(this._buildUrlFormat, collectionUri, teamProject, buildId));
            return util.format(this._buildUrlFormat, collectionUri, teamProject, buildId);
        }
    }

    // https://github.com/moby/moby/commit/df23a1e675c7e3cbad617374d85c48103541ee14?short_path=6206c94#diff-6206c94cde21ec0a5563c8369b71e609
    // Supported format for GitHub issues: #26 GH-26 repositoryName#26 repositoryNameGH-26, where GH is case in-sensitive.
    private readonly _issueRegex = new RegExp("(?:^|[^A-Za-z0-9_]?)([a-z0-9_]+/[a-zA-Z0-9-_.]+)?(?:#|[G|g][H|h]-)([0-9]+)(?:[^A-Za-z_]|$)", "gm");
    private readonly _ChangeLogTitle: string = "\n\n## Changes:\n\n";
    private readonly _seeMoreText: string = "See more";
    private readonly _changeLogVisibleLimit: number = 10;
    private readonly _buildUrlFormat: string = "%s/%s/_build/results?buildId=%s&view=logs";
    private readonly _autoGeneratedTextFormat: string = "This list of changes was [auto generated](%s).";
    private readonly _seeMoreChangeLogFormat: string = "<details><summary><b>%s</b></summary>\n\n%s\n%s</details>"; // For showing See more button if more than 10 commits message are to be shown to user.
}