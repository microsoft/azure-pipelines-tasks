import tl = require("vsts-task-lib/task");
import path = require("path");
import fs = require('fs');
import { WebResponse } from "./webClient";
import { Release } from "./Release";
import { Utility, Inputs, AssetUploadMode, GitHubAttributes } from "./Utility";

export class Action {

    public static async createReleaseAction(githubEndpoint: string, repositoryName: string, target: string, tag: string, releaseTitle: string, releaseNote: string, isDraft: boolean, isPrerelease: boolean, githubReleaseAssetInputPatterns: string[]): Promise<void> {
        try {
            console.log(tl.loc("CreatingRelease"));
            let releaseResponse: any = undefined;

            if (!isDraft) {
                releaseResponse = await Release.getReleaseByTag(githubEndpoint, repositoryName, tag);
                tl.debug("Get release by tag response:\n" + JSON.stringify(releaseResponse, null, 2));
            }

            if (!!releaseResponse && releaseResponse.statusCode === 200) {
                throw new Error(tl.loc("ReleaseAlreadyExists", tag));
            }
            else {
                tl.debug("Creating draft release");
                let response: WebResponse = await Release.createRelease(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, true, isPrerelease);
                tl.debug("Create release response:\n" + JSON.stringify(response, null, 2));

                if (response.statusCode === 201) {
                    let releaseId: string = response.body[GitHubAttributes.id];
                    try {
                        tl.debug("Uploading assets");
                        const uploadUrl: string = response.body[GitHubAttributes.uploadUrl];
                        await this._uploadAssets(githubEndpoint, repositoryName, githubReleaseAssetInputPatterns, uploadUrl, []);

                        if (!isDraft) {
                            tl.debug("Publishing release as upload assets is succesful");
                            let publishReleaseResponse = await Release.editRelease(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, releaseId);
                            tl.debug("Edit release response:\n" + JSON.stringify(response, null, 2));

                            if (publishReleaseResponse.statusCode === 200) {
                                console.log(tl.loc("CreateReleaseSuccess", publishReleaseResponse.body[GitHubAttributes.htmlUrl]));
                            }
                            else {
                                console.log(tl.loc("CreateReleaseError"));
                                await this._discardRelease(githubEndpoint, repositoryName, releaseId);
                            }
                        }
                        else {
                            console.log(tl.loc("DraftReleaseCreatedSuccess"), response.body[GitHubAttributes.htmlUrl]);
                        }
                    }
                    catch (error) {
                        await this._discardRelease(githubEndpoint, repositoryName, releaseId);
                        throw error;
                    }
                }
                else {
                    throw new Error(tl.loc("CreateReleaseError"));
                }

                tl.setResult(tl.TaskResult.Succeeded, "");
            }
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }    
    }

    public static async editReleaseAction(githubEndpoint: string, repositoryName: string, target: string, tag: string, releaseTitle: string, releaseNote: string, isDraft: boolean, isPrerelease: boolean, githubReleaseAssetInputPatterns: string[], releaseId: string): Promise<void> {
        try {
            console.log(tl.loc("EditingRelease"));

            let response: WebResponse = await Release.editRelease(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, releaseId);
            tl.debug("Edit release response:\n" + JSON.stringify(response, null, 2));

            if (response.statusCode === 200) {
                console.log(tl.loc("EditReleaseSuccess"));

                const uploadUrl: string = response.body[GitHubAttributes.uploadUrl];
                await this._uploadAssets(githubEndpoint, repositoryName, githubReleaseAssetInputPatterns, uploadUrl, response.body[GitHubAttributes.assets]);
            }
            else {
                throw new Error(tl.loc("EditReleaseError"));
            }

            tl.setResult(tl.TaskResult.Succeeded, "");
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }    
    }

    public static async discardReleaseAction(githubEndpoint: string, repositoryName: string, releaseId: string): Promise<void> {
        try {
            await this._discardRelease(githubEndpoint, repositoryName, releaseId);
            tl.setResult(tl.TaskResult.Succeeded, "");
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }    
    }

    private static async _discardRelease(githubEndpoint: string, repositoryName: string, releaseId: string): Promise<void> {
        console.log(tl.loc("DiscardingRelease"));
        let response: WebResponse = await Release.discardRelease(githubEndpoint, repositoryName, releaseId);
        tl.debug("Discard release response:\n" + JSON.stringify(response, null, 2));

        if (response.statusCode === 204) {
            console.log(tl.loc("DiscardReleaseSuccess"));
        }
        else {
            throw new Error(tl.loc("DiscardReleaseError"));
        }
    }

    private static async _uploadAssets(githubEndpoint: string, repositoryName: string, githubReleaseAssetInputPatterns: string[], uploadUrl: string, existingAssets: any[]): Promise<void> {
        const assetUploadMode = tl.getInput(Inputs.assetUploadMode);
        let assets: string[] = Utility.getUploadAssets(githubReleaseAssetInputPatterns) || [];

        Utility.validateUploadAssets(assets);

        if (!!assetUploadMode && assetUploadMode === AssetUploadMode.delete) {
            await this._deleteAssets(githubEndpoint, repositoryName, existingAssets);
        }

        for (let index = 0; index < assets.length; index++) {
            const asset = assets[index];
            console.log(tl.loc("UploadingAsset", asset));

            if (fs.lstatSync(path.resolve(asset)).isDirectory()) {
                console.log(tl.loc("AssetIsDirectoryError", asset));
                continue;
            }

            let uploadResponse = await Release.uploadReleaseAsset(githubEndpoint, asset, uploadUrl);
            tl.debug("Upload asset response:\n" + JSON.stringify(uploadResponse, null, 2));
            
            if (uploadResponse.statusCode === 201) {
                console.log(tl.loc("UploadAssetSuccess", asset));
            }
            else if (uploadResponse.statusCode === 422 && uploadResponse.body.errors && uploadResponse.body.errors.length > 0 && uploadResponse.body.errors[0].code === this._alreadyExistErrorCode) {
                
                if (assetUploadMode === AssetUploadMode.replace) {
                    console.log(tl.loc("DuplicateAssetFound", asset));
                    console.log(tl.loc("DeletingDuplicateAsset", asset));

                    const fileName = path.basename(asset);

                    for (let existingAsset of existingAssets) {
                        if (fileName === existingAsset.name) {
                            await this._deleteAssets(githubEndpoint, repositoryName, [existingAsset]);
                            index--;
                            break;
                        }
                    }
                }
                else {
                    throw new Error(tl.loc("DuplicateAssetFound", asset));
                }
            }
            else {
                throw new Error(tl.loc("UploadAssetError"));
            }
        }
    }

    private static async _deleteAssets(githubEndpoint: string, repositoryName: string, assets: any[]) {
        for (let asset of assets) {
            let deleteAssetResponse = await Release.deleteReleaseAsset(githubEndpoint, repositoryName, asset.id);
            tl.debug("Delete asset response:\n" + JSON.stringify(deleteAssetResponse, null, 2));

            if (deleteAssetResponse.statusCode === 204) {
                console.log(tl.loc("AssetDeletedSuccessfully", asset));
            }
            else {
                throw new Error(tl.loc("ErrorDeletingAsset", asset));
            }
        }
    }

    private static readonly _alreadyExistErrorCode: string = "already_exists";
}