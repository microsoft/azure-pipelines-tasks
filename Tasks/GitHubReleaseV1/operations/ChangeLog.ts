import tl = require("azure-pipelines-task-lib/task");
import util = require("util");
import { Utility, GitHubAttributes, IRepositoryIssueId, Delimiters, AzureDevOpsVariables, ChangeLogStartCommit, GitHubIssueState, ChangeLogType } from "./Utility";
import { Release } from "./Release";
import { Helper } from "./Helper";

export class ChangeLog {

    /**
     * Returns the change log.
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param target 
     * @param top 
     * @param compareWithRelease
     * @param changeLogType
     * @param changeLogCompareToReleaseTag
     * @param changeLogLabels
     */
    public async getChangeLog(githubEndpointToken: string, repositoryName: string, target: string, top: number, compareWithRelease: ChangeLogStartCommit, changeLogType: string, changeLogCompareToReleaseTag?: string, changeLogLabels?: any[]): Promise<string> {
        console.log(tl.loc("ComputingChangeLog"));

        let release = new Release();
        // We will be fetching changes between startCommitSha...endCommitSha.
        // endCommitSha: It is the current commit
        // startCommitSha: It is the commit for which previous release was created
        // If no previous release found, then it will be the first commit.

        // Get the curent commit.
        let endCommitSha: string = await new Helper().getCommitShaFromTarget(githubEndpointToken, repositoryName, target);
        //Get the start commit.
        let startCommitSha: string = await this.getStartCommitSha(githubEndpointToken, repositoryName, endCommitSha, top,compareWithRelease, changeLogCompareToReleaseTag);
        // Compare the diff between 2 commits.
        tl.debug("start commit: "+ startCommitSha + "; end commit: "+ endCommitSha);
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
                if (changeLogType === ChangeLogType.commitBased) {
                    return this._getCommitBasedChangeLog(commitIdToRepoIssueIdsDictionary, commitIdToMessageDictionary, repositoryName);
                }
                else {
                    let issues = new Set([]);
                    Object.keys(commitIdToRepoIssueIdsDictionary).forEach((commitId: string) => {
                        if (issues.size >= top) {
                            return;
                        }
                        commitIdToRepoIssueIdsDictionary[commitId].forEach(repoIssueId => {
                            if (issues.size >= top) {
                                return;
                            }
                            let issueDetails = Utility.extractRepoAndIssueId(repoIssueId);
                            let issueId = Number(issueDetails.issueId);
                            if (!!issueId && issueDetails.repository === repositoryName) {
                                issues.add(issueId);
                            }
                        });
                    });

                    if (!!changeLogLabels && !!changeLogLabels.length) {
                        return this._getIssueBasedChangeLog(Array.from(issues), repositoryName, release, githubEndpointToken, changeLogLabels);
                    }
                    else {
                        return this._getAllIssuesChangeLog(Array.from(issues), repositoryName, release, githubEndpointToken);
                    }
                }
            }
        }
        else{
            tl.error(tl.loc("FetchCommitDiffError"));
            throw new Error(commitsListResponse.body[GitHubAttributes.message]);
        }
    }
     /**
     * Generate issue based ChangeLog
     * @param issues
     * @param repositoryName 
     * @param release 
     * @param githubEndpointToken
     * @param labels
     */
    private async _getIssueBasedChangeLog(issues: number[], repositoryName: string, release: Release, githubEndpointToken: string, labels: any[]) {

        if (issues.length === 0) {
            console.log(tl.loc("NoIssuesLinkedError"));
            return "";
        }

        let issuesListResponse = await release.getIssuesList(githubEndpointToken, repositoryName, issues, true);
        if (issuesListResponse.statusCode === 200) {
            if (!!issuesListResponse.body.errors) {
                console.log(tl.loc("IssuesFetchError"));
                tl.warning(JSON.stringify(issuesListResponse.body.errors));
                return "";
            }
            else {
                let changeLog: string = "";
                let topXChangeLog: string = ""; // where 'X' is the this._changeLogVisibleLimit.
                let seeMoreChangeLog: string = "";
                let index = 0;
                let issuesList = issuesListResponse.body.data.repository;
                tl.debug("issuesListResponse: " + JSON.stringify(issuesList));
                let labelsRankDictionary = this._getLabelsRankDictionary(labels);
                tl.debug("labelsRankDictionary: " + JSON.stringify(labelsRankDictionary));
                let groupedIssuesDictionary = this._getGroupedIssuesDictionary(labelsRankDictionary, issuesList, labels);
                tl.debug("Group wise issues : " + JSON.stringify(groupedIssuesDictionary));
                Object.keys(groupedIssuesDictionary).forEach((group: string) => {
                    if (groupedIssuesDictionary[group].length === 0) return;
                    //If the only category is the default cateogry, don't add the category title.
                    if (index > 0 || group!= this._defaultGroup){
                        let changeLogGroupTitle = util.format(this._groupTitleFormat, group);
                        if (index >= this._changeLogVisibleLimit) {
                            seeMoreChangeLog = seeMoreChangeLog + changeLogGroupTitle + Delimiters.newLine;
                        }
                        else {
                            topXChangeLog = topXChangeLog + changeLogGroupTitle + Delimiters.newLine;
                            index++;
                        }
                    }
                    groupedIssuesDictionary[group].forEach(issueDetails => {
                        let changeLogPerIssue: string = this._getChangeLogPerIssue(issueDetails.id, issueDetails.issue);
                        if (index >= this._changeLogVisibleLimit) {
                            seeMoreChangeLog = seeMoreChangeLog + changeLogPerIssue + Delimiters.newLine;
                        }
                        else {
                            topXChangeLog = topXChangeLog + changeLogPerIssue + Delimiters.newLine;
                            index++;
                        }
                    });
                });
                changeLog = this._generateChangeLog(topXChangeLog, seeMoreChangeLog);
                console.log(tl.loc("ComputingChangeLogSuccess"));
                return changeLog;
            }
        }
        else {
            console.log(tl.loc("IssuesFetchError"));
            tl.warning(issuesListResponse.body[GitHubAttributes.message]);
            return "";
        }
    }
    /**
     * Generate all issue based ChangeLog without labels
     * @param issues
     * @param repositoryName 
     * @param release 
     * @param githubEndpointToken
     */
    private async _getAllIssuesChangeLog(issues: number[], repositoryName: string, release: Release, githubEndpointToken: string) {

        if (issues.length === 0) {
            console.log(tl.loc("NoIssuesLinkedError"));
            return "";
        }

        let issuesListResponse = await release.getIssuesList(githubEndpointToken, repositoryName, issues, false);
        if (issuesListResponse.statusCode === 200) {
            if (!!issuesListResponse.body.errors) {
                console.log(tl.loc("IssuesFetchError"));
                tl.warning(JSON.stringify(issuesListResponse.body.errors));
                return "";
            }
            else {
                let changeLog: string = "";
                let topXChangeLog: string = ""; // where 'X' is the this._changeLogVisibleLimit.
                let seeMoreChangeLog: string = "";
                let issuesList = issuesListResponse.body.data.repository;
                tl.debug("issuesListResponse: " + JSON.stringify(issuesList));
                Object.keys(issuesList).forEach((key: string, index: number) => {
                    let changeLogPerIssue = this._getChangeLogPerIssue(key.substr(1), issuesList[key].title);
                    // See more functionality
                    if (index >= this._changeLogVisibleLimit) {
                        seeMoreChangeLog = seeMoreChangeLog + changeLogPerIssue + Delimiters.newLine;
                    }
                    else {
                        topXChangeLog = topXChangeLog + changeLogPerIssue + Delimiters.newLine;
                    }
                });
                changeLog = this._generateChangeLog(topXChangeLog, seeMoreChangeLog);
                console.log(tl.loc("ComputingChangeLogSuccess"));
                return changeLog;
            }
        }
        else {
            console.log(tl.loc("IssuesFetchError"));
            tl.warning(issuesListResponse.body[GitHubAttributes.message]);
            return "";
        }
    }
    /**
     * Generate commit based ChangeLog
     * @param commitIdToRepoIssueIdsDictionary 
     * @param commitIdToMessageDictionary 
     * @param repositoryName 
     */
    private async _getCommitBasedChangeLog(commitIdToRepoIssueIdsDictionary: { [key: string]: Set<string> }, commitIdToMessageDictionary: { [key: string]: string }, repositoryName: string){
        let changeLog: string = "";
        let topXChangeLog: string = ""; // where 'X' is the this._changeLogVisibleLimit.
        let seeMoreChangeLog: string = "";
        // Evaluate change log
        Object.keys(commitIdToRepoIssueIdsDictionary).forEach((commitId: string, index: number) => {
            let changeLogPerCommit: string = this._getChangeLogPerCommit(commitId, commitIdToMessageDictionary[commitId], commitIdToRepoIssueIdsDictionary[commitId], repositoryName);
            //See more functionality
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
        changeLog = this._generateChangeLog(topXChangeLog, seeMoreChangeLog);
        console.log(tl.loc("ComputingChangeLogSuccess"));
        return changeLog;
    }
    /**
     * Returns the start commit needed to compute ChangeLog.
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param endCommitSha 
     * @param top 
     * @param compareWithRelease
     * @param changeLogCompareToReleaseTag
     */

    public async getStartCommitSha(githubEndpointToken: string, repositoryName: string, endCommitSha: string, top: number, compareWithRelease: ChangeLogStartCommit, changeLogCompareToReleaseTag?: string): Promise<string> {
        let release = new Release();
        let startCommitSha: string;
        if (compareWithRelease === ChangeLogStartCommit.lastFullRelease) {
            // Get the latest published release to compare the changes with.
            console.log(tl.loc("FetchLatestPublishRelease"));
            let latestReleaseResponse = await release.getLatestRelease(githubEndpointToken, repositoryName);
            tl.debug("Get latest release response: " + JSON.stringify(latestReleaseResponse));
            // Get the start commit.
            // Release has target_commitsh property but it can be branch name also.
            // Hence if a release is present, then get the tag and find its corresponding commit.
            // Else get the first commit.
            if (latestReleaseResponse.statusCode !== 200 && latestReleaseResponse.statusCode !== 404) {
                tl.error(tl.loc("GetLatestReleaseError"));
                throw new Error(latestReleaseResponse.body[GitHubAttributes.message]);
            }
            else if (latestReleaseResponse.statusCode !== 404 && latestReleaseResponse.body && !!latestReleaseResponse.body[GitHubAttributes.tagName]) {
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

            return startCommitSha;
        }

        let comparer;
        if (compareWithRelease === ChangeLogStartCommit.lastNonDraftRelease) {
            //Latest non-draft Release
            console.log(tl.loc("FetchLatestNonDraftRelease"));
            comparer = release => !release[GitHubAttributes.draft];
        }
        else {
            //Latest release with the given tag or matching the given regex.
            console.log(tl.loc("FetchLastReleaseByTag", changeLogCompareToReleaseTag));
            comparer = release => !release[GitHubAttributes.draft] && Utility.isTagMatching(release[GitHubAttributes.tagName], changeLogCompareToReleaseTag);

        }

        let initialTag = await this.getLastReleaseTag(githubEndpointToken, repositoryName, comparer);

        //If no such release exists, get the start commit
        //else get the commit for that tag.
        if (!initialTag) {
            (compareWithRelease === ChangeLogStartCommit.lastNonDraftRelease) && console.log(tl.loc("NoMatchingReleases"));
            (compareWithRelease === ChangeLogStartCommit.lastNonDraftReleaseByTag) && console.log(tl.loc("NoTagMatchingReleases", changeLogCompareToReleaseTag));
            console.log(tl.loc("FetchInitialCommit"));
            startCommitSha = await this._getInitialCommit(githubEndpointToken, repositoryName, endCommitSha, top);
            console.log(tl.loc("FetchInitialCommitSuccess", startCommitSha));
        }
        else {
            (compareWithRelease === ChangeLogStartCommit.lastNonDraftRelease) && console.log(tl.loc("FetchMatchingReleaseSuccess"));
            (compareWithRelease === ChangeLogStartCommit.lastNonDraftReleaseByTag) && console.log(tl.loc("FetchTagMatchingReleaseSuccess", changeLogCompareToReleaseTag));
            startCommitSha = await this._getCommitForTag(githubEndpointToken, repositoryName, initialTag);
        }

        return startCommitSha;
    }

    /**
     * Returns latest release satisfying the given comparer.
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param comparer 
     */
    public async getLastReleaseTag(githubEndpointToken: string, repositoryName: string, comparer:(release: any)=> boolean): Promise<string> {
        let release = new Release();
        
        // Fetching all releases in the repository. Sorted in descending order according to 'created_at' attribute.
        let releasesResponse = await release.getReleases(githubEndpointToken, repositoryName);
        let links: { [key: string]: string } = {};

        // Fetching releases api call may end up in paginated results.
        // Traversing all the pages and filtering all the releases with given tag.
        while (true) {
            tl.debug("Get releases response: " + JSON.stringify(releasesResponse));

            let startRelease: any;
            //404 is returned when there are no releases.
            if (releasesResponse.statusCode !== 200 && releasesResponse.statusCode !== 404){
                tl.error(tl.loc("GetLatestReleaseError"));
                throw new Error(releasesResponse.body[GitHubAttributes.message]);
            }
            else if (releasesResponse.statusCode === 200) {
                // Filter the releases fetched
                startRelease = (releasesResponse.body || []).find(comparer);
                if (!!startRelease) {
                    return startRelease[GitHubAttributes.tagName];
                }

                links = Utility.parseHTTPHeaderLink(releasesResponse.headers[GitHubAttributes.link]);

                // Calling the next page if it exists
                if (links && links[GitHubAttributes.next]) {
                    let paginatedResponse = await release.getPaginatedResult(githubEndpointToken, links[GitHubAttributes.next]);
                    releasesResponse = paginatedResponse;
                    continue;
                }
            }
            //If status code is 404 or there are no releases satisfying the constraints return null.
            return null;
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
     * Returns a dictionary of { key to displayname, rank }.
     * Key is labelname#issuestate
     * This dictionary is used to find the label with highest priority.
     * @param labels 
     */
    private _getLabelsRankDictionary(labels: any[]){
        let labelsRankDictionary = {};
        for (let index = 0; index < labels.length; index++){
            if (!labels[index].label || !labels[index].displayName) continue;
            let label = labels[index].label;
            let issueState = labels[index].state || this._noStateSpecified;
            let key = (label+ Delimiters.hash +issueState).toLowerCase();
            if (!labelsRankDictionary[key]){
                labelsRankDictionary[key] = {displayName: labels[index].displayName, rank: index};
            }
        }
        return labelsRankDictionary;
    }

    /**
     * Returns a dictionary of { groupname to issues }.
     * This dictionary is used to find all the issues under a display name.
     * @param labelsRankDictionary 
     * @param issuesList 
     */
    private _getGroupedIssuesDictionary(labelsRankDictionary, issuesList, labels){
        let labelsIssuesDictionary = {};
        labels.forEach(label => {
            if (!label.displayName) return;
            labelsIssuesDictionary[label.displayName] = [];
        });
        labelsIssuesDictionary[this._defaultGroup] = [];
        Object.keys(issuesList).forEach((issue: string) => {
            let group: string = null;
            let currentLabelRank: number = Number.MAX_SAFE_INTEGER;
            let issueState = issuesList[issue].state;
            //For Pull Requests, show only Merged PRs, Ignore Closed PRs
            if (!!issuesList[issue].changedFiles){
                if(issueState.toLowerCase() === GitHubIssueState.merged.toLowerCase()){
                    issueState = GitHubIssueState.closed;
                }
                else if (issueState.toLowerCase() === GitHubIssueState.closed.toLowerCase()){
                    return;
                }
            }
            issuesList[issue].labels.edges && issuesList[issue].labels.edges.forEach(labelDetails => {
                let key = (labelDetails.node.name + Delimiters.hash + issueState).toLowerCase();
                if(!labelsRankDictionary[key]) {
                    key = (labelDetails.node.name + Delimiters.hash + this._noStateSpecified).toLowerCase();
                }

                if (labelsRankDictionary[key] && labelsRankDictionary[key].rank < currentLabelRank){
                    group = labelsRankDictionary[key].displayName;
                    currentLabelRank = labelsRankDictionary[key].rank;
                }
            });
            if (currentLabelRank === Number.MAX_SAFE_INTEGER){
                group = this._defaultGroup; //Default category
            }
            labelsIssuesDictionary[group].push({"issue": issuesList[issue].title, "id": issue.substr(1)});
        });
        return labelsIssuesDictionary;
    }

    /**
     * Returns the log for a single issue.
     * Log format: * #issueId: issueTitle
     * @param issueId
     * @param issueTitle 
     */
    private _getChangeLogPerIssue(issueId: number | string, issueTitle: string){
        return Delimiters.star + Delimiters.space + Delimiters.hash + issueId + Delimiters.colon + Delimiters.space + issueTitle;
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
        let autoGeneratedUrl: string = encodeURI(this._getAutoGeneratedUrl());

        if (!!autoGeneratedUrl) {
            return util.format(this._autoGeneratedTextFormat, autoGeneratedUrl);
        }

        return "";
    }

    private _generateChangeLog(topXChangeLog: string, seeMoreChangeLog: string): string {
        let changeLog: string = "";
        if (topXChangeLog) {
            changeLog = util.format(this._changeLogTitleFormat, this._changeLogTitle) + topXChangeLog;

            if(!seeMoreChangeLog) {
                changeLog = changeLog + Delimiters.newLine + this._getAutoGeneratedText();
            }
            else {
                changeLog = changeLog + util.format(this._seeMoreChangeLogFormat, this._seeMoreText, seeMoreChangeLog, this._getAutoGeneratedText());
            }
        }
        return changeLog;
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
    private readonly _changeLogTitle: string = tl.loc("ChangeLogTitle");
    private readonly _seeMoreText: string = tl.loc("SeeMoreText");
    private readonly _noStateSpecified: string = "none";
    private readonly _defaultGroup: string = tl.loc("DefaultCategory");
    private readonly _changeLogVisibleLimit: number = 10;
    private readonly _changeLogTitleFormat: string = "\n\n## %s:\n\n";
    private readonly _groupTitleFormat: string = "\n### %s:\n\n";
    private readonly _buildUrlFormat: string = "%s/%s/_build/results?buildId=%s&view=logs";
    private readonly _autoGeneratedTextFormat: string = "This list of changes was [auto generated](%s).";
    private readonly _seeMoreChangeLogFormat: string = "<details><summary><b>%s</b></summary>\n\n%s\n%s</details>"; // For showing See more button if more than 10 commits message are to be shown to user.
}