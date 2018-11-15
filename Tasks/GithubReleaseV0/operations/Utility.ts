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

    public static getUploadAssets(githubReleaseAssetInput: string): string[] {
        let githubReleaseAssets = [];

        /** Check for one or multiples files into array
         *  Accept wildcards to look for files
         */
        if (githubReleaseAssetInput) {
            githubReleaseAssets = glob.sync(githubReleaseAssetInput);
        }

        return githubReleaseAssets;
    }

    public static validateUploadAssets(githubReleaseAssetInput: string): void {
        const assets: string[] = this.getUploadAssets(githubReleaseAssetInput);

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

    public static getReleaseNote(releaseNotesSelection: string, releaseNotesFile: any, releaseNoteInput: string): string {
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
    public static readonly tagName: string = "tag_name";
    public static readonly uploadUrl: string = "upload_url";
    public static readonly htmlUrl: string = "html_url";
    public static readonly assets: string = "assets";
    public static readonly commit: string = "commit";
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