import tl = require("vsts-task-lib/task");
import path = require("path");
import fs = require('fs');
import { WebResponse } from "./webClient";
import { Release } from "./Release";
import { Utility, Inputs, AssetUploadMode, GitHubAttributes } from "./Utility";

export class Action {

    public static async createReleaseAction(githubEndpoint: string, repositoryName: string, target: string, tag: string, releaseTitle: string, releaseNote: string, isDraft: boolean, isPrerelease: boolean, githubReleaseAssetInputPatterns: string[]): Promise<void> {
        try {
            console.log(tl.loc("CreatingRelease", tag));

            // Create release
           let response: WebResponse = await Release.createRelease(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease);
           tl.debug("Create release response:\n" + JSON.stringify(response, null, 2));

           if (response.statusCode === 201) {
               let releaseId: string = response.body[GitHubAttributes.id];
               try {
                   // Upload the assets
                   const uploadUrl: string = response.body[GitHubAttributes.uploadUrl];
                   await this._uploadAssets(githubEndpoint, repositoryName, githubReleaseAssetInputPatterns, uploadUrl, []);
                   console.log(tl.loc("CreateReleaseSuccess", response.body[GitHubAttributes.htmlUrl]));  
               }
               catch (error) {
                   // If upload asets fail, then delete the release
                   await this._discardRelease(githubEndpoint, repositoryName, releaseId, tag);
                   throw error;
               }
           } 
           else if (response.statusCode === 422 && response.body.errors && response.body.errors.length > 0 && response.body.errors[0].code === this._alreadyExistErrorCode) {
                console.log(tl.loc("ReleaseAlreadyExists", tag));  
                throw new Error(response.body[GitHubAttributes.message]);
           }
           else {
                console.log(tl.loc("CreateReleaseError"));
                throw new Error(response.body[GitHubAttributes.message]);
           }

           tl.setResult(tl.TaskResult.Succeeded, "");
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }    
    }

    public static async editReleaseAction(githubEndpoint: string, repositoryName: string, target: string, tag: string, releaseTitle: string, releaseNote: string, isDraft: boolean, isPrerelease: boolean, githubReleaseAssetInputPatterns: string[], releaseId: string): Promise<void> {
        try {
            console.log(tl.loc("EditingRelease", tag));

            let response: WebResponse = await Release.editRelease(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease, releaseId);
            tl.debug("Edit release response:\n" + JSON.stringify(response, null, 2));

            if (response.statusCode === 200) {
                console.log(tl.loc("EditReleaseSuccess", response.body[GitHubAttributes.htmlUrl]));

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

    public static async discardReleaseAction(githubEndpoint: string, repositoryName: string, releaseId: string, tag: string): Promise<void> {
        try {
            await this._discardRelease(githubEndpoint, repositoryName, releaseId, tag);
            tl.setResult(tl.TaskResult.Succeeded, "");
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }    
    }

    private static async _discardRelease(githubEndpoint: string, repositoryName: string, releaseId: string, tag: string): Promise<void> {
        console.log(tl.loc("DiscardingRelease", tag));
        let response: WebResponse = await Release.discardRelease(githubEndpoint, repositoryName, releaseId);
        tl.debug("Discard release response:\n" + JSON.stringify(response, null, 2));

        if (response.statusCode === 204) {
            console.log(tl.loc("DiscardReleaseSuccess"));
        }
        else {
            console.log(tl.loc("DiscardReleaseError"))
            throw new Error(response.body[GitHubAttributes.message]);
        }
    }

    private static async _uploadAssets(githubEndpoint: string, repositoryName: string, githubReleaseAssetInputPatterns: string[], uploadUrl: string, existingAssets: any[]): Promise<void> {
        const assetUploadMode = tl.getInput(Inputs.assetUploadMode);
        let assets: string[] = Utility.getUploadAssets(githubReleaseAssetInputPatterns) || [];

        Utility.validateUploadAssets(assets);

        // Delete all assets
        if (!!assetUploadMode && assetUploadMode === AssetUploadMode.delete) {
            await this._deleteAssets(githubEndpoint, repositoryName, existingAssets);
        }

        if (assets && assets.length > 0) {
            console.log(tl.loc("UploadingAssets"));
        }
        else {
            console.log(tl.loc("NoAssetFoundToUpload"));
            return;
        }

        for (let index = 0; index < assets.length; index++) {
            const asset = assets[index];
            console.log(tl.loc("UploadingAsset", asset));

            if (fs.lstatSync(path.resolve(asset)).isDirectory()) {
                console.warn(tl.loc("AssetIsDirectoryError", asset));
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
                    console.warn(tl.loc("SkipDuplicateAssetFound", asset));
                }
            }
            else {
                console.log(tl.loc("UploadAssetError"))
                throw new Error(uploadResponse.body[GitHubAttributes.message]);
            }
        }
    }

    private static async _deleteAssets(githubEndpoint: string, repositoryName: string, assets: any[]) {
        if (assets && assets.length ===  0) {
            console.log(tl.loc("NoAssetFoundToDelete"));
        }

        for (let asset of assets) {
            console.log(tl.loc("DeletingAsset", asset));
            let deleteAssetResponse = await Release.deleteReleaseAsset(githubEndpoint, repositoryName, asset.id);
            tl.debug("Delete asset response:\n" + JSON.stringify(deleteAssetResponse, null, 2));

            if (deleteAssetResponse.statusCode === 204) {
                console.log(tl.loc("AssetDeletedSuccessfully", asset));
            }
            else {
                console.log(tl.loc("ErrorDeletingAsset", asset));
                throw new Error(deleteAssetResponse.body[GitHubAttributes.message]);
            }
        }
    }

    private static readonly _alreadyExistErrorCode: string = "already_exists";
}