import tl = require("vsts-task-lib/task");
import { Inputs, TagSelectionMode, Utility, GitHubAttributes, AzureDevOpsVariables} from "./Utility";
import { Release } from "./Release";

interface IRelease {
    tagName: string;
    id: number;
}

export class Helper {
    
    /**
     * Returns tag name to be used for creating a release.
     * If user has specified tag, then use it 
     * else if $(Build.SourceBranch) is referencing to a tag, then parse tag name and use it
     * else fetch tag from the target specified by user
     * if no tag found for that target commit, then return undefined
     * else if more than 1 tag found, then throw error
     * else return the found tag name
     * @param githubEndpoint 
     * @param repositoryName 
     * @param target 
     * @param tag 
     */
    public static async getTagForCreateAction(githubEndpoint: string, repositoryName: string, target: string, tag: string): Promise<string> {
        let tagSelection = tl.getInput(Inputs.tagSelection);

        if (!!tagSelection && tagSelection === TagSelectionMode.auto) {
            // Tag should be set to undefined as it can have some value even if tag selection mode is auto if user has changed it.
            tag = undefined; 
            let commit_sha: string = await this.getCommitShaFromTarget(githubEndpoint, repositoryName, target);
            let buildSourceVersion = tl.getVariable(AzureDevOpsVariables.buildSourceVersion);

            // If the buildSourceVersion and user specified target does not match, then prefer user specified target
            if (commit_sha !== buildSourceVersion) {
                tag = await this._getTagForCommit(githubEndpoint, repositoryName, commit_sha);
            }
            else {
                let buildSourceBranch = tl.getVariable(AzureDevOpsVariables.buildSourceBranch);
                let normalizedBranch = Utility.normalizeBranchName(buildSourceBranch);

                // Check if branch is referencing to tag, if yes, then parse tag from branch name e.g. refs/tags/v1.0.1
                // Else fetch tag from commit
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

    /**
     * Returns latest commit on the target if target is branch else returns target.
     * Target can be branch as well e.g. 'master' and in this scenario we need to fetch commit associated to that branch
     * @param githubEndpoint 
     * @param repositoryName 
     * @param target 
     */
    public static async getCommitShaFromTarget(githubEndpoint: string, repositoryName: string, target: string): Promise<string> {
        let commit_sha: string = undefined;
        let response = await Release.getBranch(githubEndpoint, repositoryName, target);
        tl.debug("Get branch response:\n" + JSON.stringify(response, null, 2));

        if (response.statusCode === 200) {
            commit_sha = response.body[GitHubAttributes.commit][GitHubAttributes.sha];
        }
        else if (response.statusCode === 404) {
            commit_sha = target;
        }
        else {
            console.log(tl.loc("GetBranchError"));
            throw new Error(response.body[GitHubAttributes.message]);
        }

        return commit_sha;
    }

    /**
     * Returns releaseId associated with the tag.
     * If 0 release found return undefined
     * else if 1 release found return releaseId
     * else throw error
     * @param githubEndpoint 
     * @param repositoryName 
     * @param tag 
     */
    public static async getReleaseIdForTag(githubEndpoint: string, repositoryName: string, tag: string): Promise<any> {

        // Fetching all releases in the repository.
        let releasesResponse = await Release.getReleases(githubEndpoint, repositoryName);
        let releasesWithGivenTag: IRelease[] = [];
        let links: { [key: string]: string } = {};

        // Fetching releases api call may end up in paginated results.
        // Traversing all the pages and filtering all the releases with given tag.
        while (true) {
            tl.debug("Get releases response:\n" + JSON.stringify(releasesResponse, null, 2));

            if (releasesResponse.statusCode === 200) {
                // Filter the releases fetched
                (releasesResponse.body || []).forEach(release => {
                    // Push release if tag matches
                    if (release[GitHubAttributes.tagName] === tag) {
                        releasesWithGivenTag.push({
                            tagName: release[GitHubAttributes.tagName],
                            id: release[GitHubAttributes.id]
                        } as IRelease);
                    }
                });

                // Throw error in case of ambiguity as we do not know which release to pick for editing or discarding release.
                if (releasesWithGivenTag.length >= 2) {
                    throw new Error(tl.loc("MultipleReleasesFoundError", tag));
                }

                tl.debug("Header link: " + releasesResponse.headers[GitHubAttributes.link])
                links = Utility.parseHTTPHeaderLink(releasesResponse.headers[GitHubAttributes.link]);
                tl.debug("Parsed links: " + JSON.stringify(links));

                // Calling the next page if it exists
                if (links && links[GitHubAttributes.next]) {
                    let paginatedResponse = await Release.getPaginatedResult(githubEndpoint, links[GitHubAttributes.next]);
                    releasesResponse = paginatedResponse;
                    continue;
                }
                else {
                    return releasesWithGivenTag.length === 0 ? null : releasesWithGivenTag[0].id;
                }
            }
            else {
                console.log(tl.loc("GetReleasesError"));
                throw new Error(releasesResponse.body[GitHubAttributes.message]);
            }
        }
    }   

    /**
     * Returns tag object associated with the commit.
     * If 0 tag found return undefined
     * else if 1 tag found return tag object
     * else throw error
     * @param githubEndpoint 
     * @param repositoryName 
     * @param filterValue 
     * @param filterTagsCallback Callback to filter the tags
     */
    public static async filterTag(githubEndpoint: string, repositoryName: string, filterValue: string, filterTagsCallback: (tagsList: any[], filterValue: string) => any[]): Promise<any> {
        
        // Fetching the tags in the repository
        let tagsResponse = await Release.getTags(githubEndpoint, repositoryName);
        let links: { [key: string]: string } = {};
        let filteredTags: any[] = [];

        // Fetching tags api call may end up in paginated results.
        // So, traversing pages one by one and throwing error if more than 1 tag found.
        while (true) {
            tl.debug("Get tags response:\n" + JSON.stringify(tagsResponse, null, 2));

            if (tagsResponse.statusCode === 200) {
                tl.debug("Header link: " + tagsResponse.headers[GitHubAttributes.link])

                // Parse header link and get links to different pages
                links = Utility.parseHTTPHeaderLink(tagsResponse.headers[GitHubAttributes.link]);
                tl.debug("Parsed links: " + JSON.stringify(links));
                
                // Filter the tags returned in current page
                let tags: any[] = filterTagsCallback(tagsResponse.body, filterValue);
                tl.debug("filteredTags length: " + tags.length);

                if (!!tags && tags.length > 0) {
                    // Push returned tags in filtered tags.
                    tags.forEach((tag: any) => {
                        filteredTags.push(tag);
                    })

                    // Throw error in case of ambiguity as we do not know which tag to pick for creating release.
                    if (filteredTags.length >= 2 ) {
                        throw new Error(tl.loc("MultipleTagFound", filterValue));
                    }
                }

                // Calling the next page if it exists
                if (links && links[GitHubAttributes.next]) {
                    let paginatedResponse = await Release.getPaginatedResult(githubEndpoint, links[GitHubAttributes.next]);
                    tagsResponse = paginatedResponse;
                    continue;
                }
                else {
                    return filteredTags.length === 0 ? undefined : filteredTags[0];
                }
            }
            else{
                console.log(tl.loc("GetTagsError"));
                throw new Error(tagsResponse.body[GitHubAttributes.message]);
            }
        }
    }
    
    /**
     * Returns tag name associated with the commit.
     * If 0 tag found return undefined
     * else if 1 tag found return tag name
     * else throw error
     * @param githubEndpoint 
     * @param repositoryName 
     * @param commit_sha 
     */
    private static async _getTagForCommit(githubEndpoint: string, repositoryName: string, commit_sha: string): Promise<string> {
        let filteredTag: any = await this.filterTag(githubEndpoint, repositoryName, commit_sha, this._filterTagsByCommitSha);
        tl.debug("filtered tag _getTagForCommit: " + JSON.stringify(filteredTag));

        return filteredTag && filteredTag[GitHubAttributes.nameAttribute];
    }

    /**
     * Returns an array of matched tags, filtering on basis of commit sha
     */
    private static _filterTagsByCommitSha = (tagsList: any[], commit_sha: string): any[] => {
        let filteredTags: any[] = [];

        for (let tag of (tagsList || [])) {
            if (tag[GitHubAttributes.commit][GitHubAttributes.sha] === commit_sha) {
                filteredTags.push(tag);
            }
        }

        return filteredTags;
    }
}