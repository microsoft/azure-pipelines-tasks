import tl = require("azure-pipelines-task-lib/task");
import path = require("path");
import glob = require('glob');
import fs = require('fs');

export class Utility {

    public static getGithubEndPointToken(githubEndpoint: string): string {
        const githubEndpointObject = tl.getEndpointAuthorization(githubEndpoint, false);
        let githubEndpointToken: string = null;

        if (!!githubEndpointObject) {
            tl.debug("Endpoint scheme: " + githubEndpointObject.scheme);
            
            if (githubEndpointObject.scheme === 'PersonalAccessToken') {
                githubEndpointToken = githubEndpointObject.parameters.accessToken
            } else if (githubEndpointObject.scheme === 'OAuth'){
                // scheme: 'OAuth'
                githubEndpointToken = githubEndpointObject.parameters.AccessToken
            } else if (githubEndpointObject.scheme === 'Token'){
                // scheme: 'Token'
                githubEndpointToken = githubEndpointObject.parameters.AccessToken
            } else if (githubEndpointObject.scheme) {
                throw new Error(tl.loc("InvalidEndpointAuthScheme", githubEndpointObject.scheme));
            }
        }

        if (!githubEndpointToken) {
            throw new Error(tl.loc("InvalidGitHubEndpoint", githubEndpoint));
        }

        return githubEndpointToken;
    }

    public static getUploadAssets(pattern: string): string[] {
        let githubReleaseAssets: Set<string> = new Set();

        /** Check for one or multiples files into array
         *  Accept wildcards to look for files
         */
        let filePaths: string[] = glob.sync(pattern);

        (filePaths || []).forEach((filePath) => {
            if (!githubReleaseAssets.has(filePath)) {
                githubReleaseAssets.add(filePath)
            }
        })

        return Array.from(githubReleaseAssets);
    }

    public static isFile(asset: string): boolean {
        return fs.lstatSync(path.resolve(asset)).isFile();
    }

    public static isPatternADirectory(assets: string[], pattern: string): boolean {
        if (assets && assets.length === 1 && pattern) {
            if ((path.resolve(assets[0]) === path.resolve(pattern)) && tl.exist(path.resolve(pattern)) && tl.stats(path.resolve(pattern)).isDirectory()) {
                tl.debug("Pattern is a directory " + pattern);
                return true;
            }
        }
        return false;
    }

    public static validateUploadAssets(assets: string[]): void {
        if (assets && assets.length > 0) {
            try {
                assets.forEach(function (asset) {
                    fs.accessSync(path.resolve(asset));
                })
            } catch (err) {
                tl.warning(tl.loc("MissingAssetError", err.path));
            }
        }
    }

    public static getReleaseNote(releaseNotesSource: string, releaseNotesFile: any, releaseNoteInput: string, changeLog: string): string {
        let releaseNote: string = "";

        if (releaseNotesSource === ReleaseNotesSelectionMode.filePath) {

            if (fs.lstatSync(path.resolve(releaseNotesFile)).isDirectory()) {
                console.log(tl.loc("ReleaseNotesFileIsDirectoryError", releaseNotesFile));
            }
            else {
                releaseNote = fs.readFileSync(releaseNotesFile).toString();
            }
        }
        else {
            releaseNote = releaseNoteInput;
        }
        tl.debug("ReleaseNote:\n" + releaseNote);

        if (!releaseNote) {
            releaseNote = "";
        }

        // Append commits and issues to release note.
        if (changeLog){
            releaseNote = releaseNote + changeLog;
        }

        return releaseNote;
    }

    public static getGitHubApiUrl(): string {
        let githubApiUrlInput: string = undefined; // Todo: mdakbar: get GHE url
        return githubApiUrlInput ? githubApiUrlInput : this._githubApiUrl; // url without slash at end
    }

    public static normalizeBranchName(branchName: string): string {
        if (!!branchName && branchName.startsWith(this._tagRef)) {
            return branchName.substring(this._tagRef.length);
        }
        return undefined;
    }

    /**
     * Returns the parsed HTTP header link if it exists.
     * E.g. Link: '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next", <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"'
     * Returned object would be like {
     *  "next": "https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2",
     *  "last": "https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34"
     * }
     * @param headerLink 
     */
    public static parseHTTPHeaderLink(headerLink: string): { [key: string]: string } {
        if (!headerLink) {
            // No paginated results found
            return null; 
        }
        
        // Split pages by comma as pages are separated by comma
        let pages = headerLink.split(Delimiters.comma);
        let links: { [key: string]: string } = {};

        // Parse each page to get link and rel
        (pages || []).forEach((page) => {
            let section: string[] = page.split(Delimiters.semiColon);

            // Atleast link and rel should be present else header link format has changed
            if (section.length < 2) {
                throw new Error("section could not be split on ';'");
            }

            // Reference - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/n
            // Get link
            let urlMatch = section[0].trim().match(this._githubPaginatedLinkRegex); // If it didn't match, it will return null, else it will return match at first position
            let relMatch = null;

            // Get rel, there can be other attributes like rel. So for loop is needed to filter rel attribute.
            for (let i = 1; i < section.length; i++) {
                relMatch = section[i].trim().match(this._githubPaginatedRelRegex); // If it didn't match, it will return null, else it will return match at first position

                // Break as soon as rel attribute is found
                if (!!relMatch) {
                    break;
                }
            }

            // If both link and rel are found, append it to dictionary
            if (urlMatch && relMatch) {
                links[relMatch[1]] = urlMatch[1];
            }

        })

        tl.debug("Parsed link: " + JSON.stringify(links));
        return links;
    }

    public static extractRepositoryOwnerAndName(repositoryName: string): IGitHubRepositoryInfo {
        let repositoryInfo = repositoryName.split(Delimiters.slash);
        
        return {
            owner: repositoryInfo[0],
            name: repositoryInfo[1]
        }
    }

    public static extractRepoAndIssueId(repoIssueId: string): IRepositoryIssueId {
        let repoIssueIdInfo: string[] = repoIssueId.split(Delimiters.hash);
        let repo: string = repoIssueIdInfo[0];
        let issueId: string = repoIssueIdInfo[1];

        return {
            repository: repo,
            issueId: issueId
        }
    }

    public static getFirstLine(commitMessage: string): string {
        commitMessage = (commitMessage || "").trim();
        const match = commitMessage.match(this._onlyFirstLine);

        tl.debug("Commit message: " + commitMessage);
        tl.debug("match: " + match);

        return match[0];
    }

    public static isTagSourceAuto(tagSource: string) {
        return (tagSource === TagSelectionMode.gitTag);
    }

    public static validateTagSource(tagSource: string, action: string) {
        if (action === ActionType.create && tagSource !== TagSelectionMode.gitTag && tagSource !== TagSelectionMode.userSpecifiedTag) {
            throw new Error(tl.loc("InvalidTagSource", tagSource));
        }
    }

    public static validateAction(action: string) {
        if (action !== ActionType.create && action !== ActionType.edit && action !== ActionType.delete) {
            tl.debug("Invalid action input"); // for purpose of L0 test only.
            throw new Error(tl.loc("InvalidActionSet", action));
        }
    }

    public static validateReleaseNotesSource(releaseNotesSource: string) {
        if (releaseNotesSource !== ReleaseNotesSelectionMode.filePath && releaseNotesSource !== ReleaseNotesSelectionMode.inline) {
            throw new Error(tl.loc("InvalidReleaseNotesSource", releaseNotesSource));
        }
    }

    public static validateStartCommitSpecification(compareWith: string) {
        if (compareWith.toUpperCase() !== changeLogStartCommitSpecification.lastFullRelease.toUpperCase() 
            && compareWith.toUpperCase() !== changeLogStartCommitSpecification.lastNonDraftRelease.toUpperCase()
            && compareWith.toUpperCase() != changeLogStartCommitSpecification.lastNonDraftReleaseByTag.toUpperCase()) {
            throw new Error(tl.loc("InvalidCompareWithAttribute", compareWith));
        }
    }

    public static validateChangeLogType(changeLogType: string) {
        if (changeLogType.toUpperCase() !== ChangeLogType.issueBased.toUpperCase() 
        && changeLogType.toUpperCase() !== ChangeLogType.commitBased.toUpperCase() ) {
        throw new Error(tl.loc("InvalidChangeLogTypeAttribute", changeLogType));
    }
    }
    public static validateAssetUploadMode(assetUploadMode: string) {
        if (assetUploadMode !== AssetUploadMode.delete && assetUploadMode !== AssetUploadMode.replace) {
            throw new Error(tl.loc("InvalidAssetUploadMode", assetUploadMode));
        }
    }

    public static validateTag(tag: string, tagSource: string, action: string) {
        if (!tag) {
            if (action === ActionType.edit || action === ActionType.delete) {
                throw new Error(tl.loc("TagRequiredEditDeleteAction", action));
            }
            else if (action === ActionType.create && !this.isTagSourceAuto(tagSource)) {
                throw new Error(tl.loc("TagRequiredCreateAction"));
            }
        }
        
    }

    public static isTagMatching(tag: string, tagPattern: string): boolean {
        let tagPatternRegex = new RegExp("^" + tagPattern + "$");
        return tagPatternRegex.test(tag);
    }

    private static readonly _onlyFirstLine = new RegExp("^.*$", "m");
    private static readonly _githubPaginatedLinkRegex = new RegExp("^<(.*)>$");
    private static readonly _githubPaginatedRelRegex = new RegExp('^rel="(.*)"$');
    private static readonly _tagRef: string = "refs/tags/";
    private static readonly _githubApiUrl: string = "https://api.github.com"; // url without slash at end
}

export class TagSelectionMode {
    public static readonly gitTag: string = "gitTag";
    public static readonly userSpecifiedTag: string = "userSpecifiedTag";
}

export class AssetUploadMode {
    public static readonly delete = "delete";
    public static readonly replace = "replace";
}

export class changeLogStartCommitSpecification {
    public static readonly lastFullRelease = "lastFullRelease";
    public static readonly lastNonDraftRelease = "lastNonDraftRelease";
    public static readonly lastNonDraftReleaseByTag = "lastNonDraftReleaseByTag";
}

export enum ChangeLogStartCommit{
    lastFullRelease = 0,
    lastNonDraftRelease,
    lastNonDraftReleaseByTag
}

export class ChangeLogType{
    public static readonly issueBased = "issueBased";
    public static readonly commitBased = "commitBased";
}
class ReleaseNotesSelectionMode {
    public static readonly inline = "inline";
    public static readonly filePath = "filePath";
}

export class GitHubIssueState{
    public static readonly closed = "CLOSED";
    public static readonly merged = "MERGED";
}

export class GitHubAttributes {
    public static readonly id: string = "id";
    public static readonly nameAttribute: string = "name";
    public static readonly tagName: string = "tag_name";
    public static readonly uploadUrl: string = "upload_url";
    public static readonly htmlUrl: string = "html_url";
    public static readonly assets: string = "assets";
    public static readonly commit: string = "commit";
    public static readonly message: string = "message";
    public static readonly state: string = "state";
    public static readonly title: string = "title";
    public static readonly commits: string = "commits";
    public static readonly sha: string = "sha";
    public static readonly behind: string = "behind";
    public static readonly status: string = "status";
    public static readonly link: string = "link";
    public static readonly next: string = "next";
    public static readonly draft: string = "draft";
    public static readonly preRelease: string = "prerelease";
}

export class ActionType {
    public static readonly create = "create";
    public static readonly edit = "edit";
    public static readonly delete = "delete";
}

export class AzureDevOpsVariables {
    public static readonly buildSourceVersion: string = "Build.SourceVersion";
    public static readonly buildSourceBranch: string = "Build.SourceBranch"; 
    public static readonly releaseWebUrl: string = "Release.ReleaseWebURL"; 
    public static readonly collectionUri: string = "System.TeamFoundationCollectionUri"; 
    public static readonly teamProject: string = "System.TeamProject"; 
    public static readonly buildId: string = "Build.BuildId"; 
    public static readonly releaseId: string = "Release.ReleaseId"; 
}

export interface IGitHubRepositoryInfo {
    owner: string;
    name: string;
}

export interface IRepositoryIssueId {
    repository: string;
    issueId: string;
}

export class Delimiters {
    public static readonly newLine: string = "\n";
    public static readonly hash: string = "#";
    public static readonly slash: string = "/";
    public static readonly semiColon: string = ";";
    public static readonly comma: string = ",";
    public static readonly space: string = " ";
    public static readonly openingBracketWithSpace: string = " [";
    public static readonly closingBracketWithSpace: string = " ]";
    public static readonly star: string = "*";
    public static readonly colon: string = ":";
}
