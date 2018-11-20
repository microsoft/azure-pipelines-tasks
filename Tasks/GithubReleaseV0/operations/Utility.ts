import tl = require("vsts-task-lib/task");
import path = require("path");
import glob = require('glob');
import fs = require('fs');

export class Utility {

    public static getGithubEndPointToken(githubEndpoint: string): string {
        const githubEndpointObject = tl.getEndpointAuthorization(githubEndpoint, false);
        let githubEndpointToken: string = null;

        if (githubEndpointObject.scheme === 'PersonalAccessToken') {
            githubEndpointToken = githubEndpointObject.parameters.accessToken
        } else {
            // scheme: 'OAuth'
            githubEndpointToken = githubEndpointObject.parameters.AccessToken
        }

        return githubEndpointToken;
    }

    public static getUploadAssets(githubReleaseAssetInputPatterns: string[]): string[] {
        let githubReleaseAssets: Set<string> = new Set();

        (githubReleaseAssetInputPatterns || []).forEach(pattern => {
            /** Check for one or multiples files into array
             *  Accept wildcards to look for files
             */
            let filePaths: string[] = glob.sync(pattern);

            filePaths.forEach((filePath) => {
                if (!githubReleaseAssets.has(filePath)) {
                    tl.debug("Adding filePath: " + filePath);
                    githubReleaseAssets.add(filePath)
                }
                else {
                    // File already added by previous pattern
                    tl.debug("FilePath already added: " + filePath);
                }
            })
        });

        return Array.from(githubReleaseAssets);
    }

    public static validateUploadAssets(assets: string[]): void {
        if (assets && assets.length > 0) {
            try {
                assets.forEach(function (asset) {
                    fs.accessSync(path.resolve(asset));
                })
            } catch (err) {
                throw new Error(tl.loc("MissingAssetError", err.path));
            }
        }
    }

    public static getReleaseNote(releaseNotesSelection: string, releaseNotesFile: any, releaseNoteInput: string, changeLog: string): string {
        let releaseNote: string = undefined;

        if (releaseNotesSelection === ReleaseNotesSelectionMode.file) {

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

        // Append commits and issues to release note.
        releaseNote = releaseNote + "\n\nChange log:\n\n" + changeLog;

        return releaseNote;
    }

    public static getGitHubApiUrl(): string {
        let githubApiUrlInput: string = undefined; // Todo: mdakbar: get GHE url
        return githubApiUrlInput ? githubApiUrlInput : "https://api.github.com"; // url without slash at end
    }

    public static normalizeBranchName(branchName: string): string {
        if (!!branchName && branchName.startsWith(this._tagRef)) {
            return branchName.substring(this._tagRef.length);
        }
        return undefined;
    }

    public static parseHTTPHeaderLink(headerLink: string) {
        if (!!headerLink && headerLink.length == 0) {
            // No paginated results found
            return null; 
        }
        
        // Split pages by comma
        let pages = headerLink.split(',');
        let links: { [key: string]: string } = {};

        // Parse each page into a named link
        (pages || []).forEach((page) => {
            let section = page.split(';');

            if (section.length != 2) {
                throw new Error("section could not be split on ';'");
            }
            // Todo: check for rel as there can be other attributes as well

            // Reference - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/n
            var url = section[0].replace(/<(.*)>/, '$1').trim();
            var name = section[1].replace(/rel="(.*)"/, '$1').trim();

            links[name] = url;
        })
    
        return links;
    }

    public static extractRepositoryOwnerAndName(repositoryName: string): IGitHubRepositoryInfo {
        let repositoryInfo = repositoryName.split('/');
        
        return {
            owner: repositoryInfo[0],
            name: repositoryInfo[1]
        }
    }

    private static _tagRef: string = "refs/tags/";
}

export class Inputs {
    public static readonly action = "action";
    public static readonly repositoryName = "repositoryName";
    public static readonly tag = "tag";
    public static readonly tagSelection = "tagSelection";
    public static readonly target = "target";
    public static readonly releaseTitle = "releaseTitle";
    public static readonly isDraft = "isDraft";
    public static readonly isPrerelease = "isPrerelease";
    public static readonly githubEndpoint = "githubEndpoint";
    public static readonly githubReleaseAsset = "githubReleaseAsset";
    public static readonly assetUploadMode = "assetUploadMode";
    public static readonly releaseNotesSelection = "releaseNotesSelection";
    public static readonly releaseNotesFile = "releaseNotesFile";
    public static readonly releaseNotesInput = "releaseNotesInput";
    public static readonly deleteExistingAssets = "deleteExistingAssets";
}

export class TagSelectionMode {
    public static readonly auto: string = "auto";
    public static readonly manual: string = "manual";
}

export class AssetUploadMode {
    public static readonly delete = "delete";
    public static readonly replace = "replace";
}

class ReleaseNotesSelectionMode {
    public static readonly input = "input";
    public static readonly file = "file";
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
}

export class ActionType {
    public static readonly create = "Create";
    public static readonly edit = "Edit";
    public static readonly discard = "Discard";
}

export class AzureDevOpsVariables {
    public static buildSourceVersion: string = "Build.SourceVersion";
    public static buildSourceBranch: string = "Build.SourceBranch"; 
}

export interface IGitHubRepositoryInfo {
    owner: string;
    name: string;
}

export interface IRepositoryIssueId {
    repository: string;
    issueId: string;
}