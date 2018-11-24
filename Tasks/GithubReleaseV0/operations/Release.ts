import tl = require("vsts-task-lib/task");
import util = require("util");
import path = require("path");
import fs = require('fs');
import mime = require('browserify-mime');
import { Utility } from "./Utility";
import { WebRequest, sendRequest, WebResponse } from "./webClient";

export class Release {

    public static async createRelease(githubEndpointToken: string, repositoryName: string, target: string, tag: string, releaseTitle: string, releaseNote: string, isDraft: boolean, isPrerelease: boolean): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._createReleaseApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName);
        request.method = "POST";
        request.body = JSON.stringify({
            "tag_name": tag,
            "target_commitish": target,
            "name": releaseTitle,
            "body": releaseNote,
            "draft": isDraft,
            "prerelease": isPrerelease
        });
        request.headers = {
            "Content-Type": "application/json",
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Create release request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public static async editRelease(githubEndpointToken: string, repositoryName: string, target: string, tag: string, releaseTitle: string, releaseNote: string, isDraft: boolean, isPrerelease: boolean, releaseId: string): Promise<WebResponse> {
        let request = new WebRequest();
            
        request.uri = util.format(this._editOrDiscardReleaseApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, releaseId);
        request.method = "PATCH";
        request.body = JSON.stringify({
            "tag_name": tag,
            "target_commitish": target,
            "name": releaseTitle,
            "body": releaseNote,
            "draft": isDraft,
            "prerelease": isPrerelease
        });
        request.headers = {
            "Content-Type": "application/json",
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Edit release request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public static async discardRelease(githubEndpointToken: string, repositoryName: string, releaseId: string): Promise<WebResponse> {
        let request = new WebRequest();
            
        request.uri = util.format(this._editOrDiscardReleaseApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, releaseId);
        request.method = "DELETE";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Discard release request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public static async deleteReleaseAsset(githubEndpointToken: string, repositoryName: string, asset_id: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._deleteReleaseAssetApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, asset_id);
        request.method = "DELETE";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Delete release asset request: " + JSON.stringify(request));

        return await sendRequest(request);
    }


    public static async uploadReleaseAsset(githubEndpointToken: string, filePath: string, uploadUrl: string): Promise<WebResponse> {
        let fileName = path.basename(filePath);
        tl.debug("Filename: " + fileName);
        
        let rd = fs.createReadStream(filePath);
        var stats = fs.statSync(filePath);

        let request = new WebRequest();
        request.uri = util.format(this._uploadReleaseAssetApiUrlFormat, uploadUrl.split('{')[0], fileName);
        request.method = "POST";
        request.headers = {
            "Content-Type": mime.lookup(fileName),
            'Content-Length': stats.size,
            'Authorization': 'token ' + githubEndpointToken
        };
        request.body = rd;
        tl.debug("Upload release request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public static async getBranch(githubEndpointToken: string, repositoryName: string, target: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getBranchApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, target);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get branch request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public static async getTags(githubEndpointToken: string, repositoryName: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getTagsApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get tags request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public static async getReleases(githubEndpointToken: string, repositoryName: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getReleasesApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get releases request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public static async getLatestRelease(githubEndpointToken: string, repositoryName: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getLatestReleasesApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get latest release request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public static async getPaginatedResult(githubEndpointToken: string, nextPageLink: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = nextPageLink;
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get paginated request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public static async getCommitsList(githubEndpointToken: string,repositoryName: string, startCommitSha: string, endCommitSha: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getCommitsListApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, startCommitSha, endCommitSha);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get commits list request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public static async getCommitsBeforeGivenSha(githubEndpointToken: string,repositoryName: string, sha: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getCommitsBeforeGivenShaApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, sha);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get commits before given sha request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    private static readonly _createReleaseApiUrlFormat: string = "%s/repos/%s/releases";
    private static readonly _editOrDiscardReleaseApiUrlFormat: string = "%s/repos/%s/releases/%s";
    private static readonly _deleteReleaseAssetApiUrlFormat: string = "%s/repos/%s/releases/assets/%s";
    private static readonly _uploadReleaseAssetApiUrlFormat: string = "%s?name=%s";
    private static readonly _getReleasesApiUrlFormat: string = "%s/repos/%s/releases";
    private static readonly _getLatestReleasesApiUrlFormat: string = "%s/repos/%s/releases/latest";
    private static readonly _getBranchApiUrlFormat: string = "%s/repos/%s/branches/%s";
    private static readonly _getTagsApiUrlFormat: string = "%s/repos/%s/tags";
    private static readonly _getCommitsListApiUrlFormat: string = "%s/repos/%s/compare/%s...%s";
    private static readonly _getCommitsBeforeGivenShaApiUrlFormat: string = "%s/repos/%s/commits?sha=%s&per_page=100";
}