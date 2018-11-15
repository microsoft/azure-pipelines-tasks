import tl = require("vsts-task-lib/task");
import path = require("path");
import fs = require('fs');
import { WebResponse } from "./webClient";
import { Release } from "./Release";
import { Utility, Inputs, AssetUploadMode } from "./Utility";

export class Action {

    public static async createReleaseAction(githubEndpoint: string, repositoryName: string, target: string, tag: string, releaseTitle: string, releaseNote: string, isDraft: boolean, isPrerelease: boolean, githubReleaseAssetInput: string): Promise<void> {
        try {
            Utility.validateUploadAssets(githubReleaseAssetInput); 
            console.log(tl.loc("CreatingRelease"));

            let response: WebResponse = await Release.createRelease(githubEndpoint, repositoryName, target, tag, releaseTitle, releaseNote, isDraft, isPrerelease);
            tl.debug("Create release response:\n" + JSON.stringify(response));

            if (response.statusCode === 201) {
                if (!tl.getBoolInput(Inputs.isDraft)) {
                    console.log(tl.loc("CreateReleaseSuccess", response.body[this._htmlUrlkey]));
                }
                else {
                    console.log(tl.loc("DraftReleaseCreatedSuccess"), response.body[this._htmlUrlkey]);
                }

                const uploadUrl: string = response.body[this._uploadUrlkey];
                await this._uploadAssets(githubEndpoint, repositoryName, githubReleaseAssetInput, uploadUrl, []);
            }
            else {           
                throw new Error(tl.loc("CreateReleaseError"));
            }

            tl.setResult(tl.TaskResult.Succeeded, "");
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }    
    }

    public static async editReleaseAction(githubEndpoint: string, repositoryName: string, tag: string, releaseTitle: string, releaseNote: string, isDraft: boolean, isPrerelease: boolean, githubReleaseAssetInput: string): Promise<void> {
        try {
            Utility.validateUploadAssets(githubReleaseAssetInput);     
            console.log(tl.loc("EditingRelease"));

            let response: WebResponse = await Release.editRelease(githubEndpoint, repositoryName, tag, releaseTitle, releaseNote, isDraft, isPrerelease);
            tl.debug("Edit release response:\n" + JSON.stringify(response));

            if (response.statusCode === 200) {
                console.log(tl.loc("EditReleaseSuccess"));

                const uploadUrl: string = response.body[this._uploadUrlkey];
                await this._uploadAssets(githubEndpoint, repositoryName, githubReleaseAssetInput, uploadUrl, response.body[this._assetsKey]);
            }
            else {
                throw new Error(tl.loc("EditReleaseError"));
            }

            tl.setResult(tl.TaskResult.Succeeded, "");
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }    
    }

    public static async discardReleaseAction(githubEndpoint: string, repositoryName: string, tag: string): Promise<void> {
        try {
            console.log(tl.loc("DiscardingRelease"));
            let response: WebResponse = await Release.discardRelease(githubEndpoint, repositoryName, tag);
            tl.debug("Discard release response:\n" + JSON.stringify(response));

            if (response.statusCode === 204) {
                console.log(tl.loc("DiscardReleaseSuccess"));
            }
            else {
                throw new Error(tl.loc("DiscardReleaseError"));
            }

            tl.setResult(tl.TaskResult.Succeeded, "");
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }    
    }

    private static async _uploadAssets(githubEndpoint: string, repositoryName: string, githubReleaseAssetInput: string, uploadUrl: string, existingAssets: any[]): Promise<void> {
        const assetUploadMode = tl.getInput(Inputs.assetUploadMode);
        let assets: string[] = Utility.getUploadAssets(githubReleaseAssetInput) || [];

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
            
            if (uploadResponse.statusCode === 201) {
                console.log(tl.loc("UploadAssetSuccess", asset));
            }
            else if (uploadResponse.statusCode === 422 && uploadResponse.body.errors && uploadResponse.body.errors.length > 0 && uploadResponse.body.errors[0].code === 'already_exists') {
                
                if (!!assetUploadMode && assetUploadMode === AssetUploadMode.replace) {
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
                    tl.debug("Upload asset response:\n" + JSON.stringify(uploadResponse));
                    throw new Error(tl.loc("DuplicateAssetFound", asset));
                }
            }
            else {
                tl.debug("Upload asset response:\n" + JSON.stringify(uploadResponse));
                throw new Error(tl.loc("UploadAssetError"));
            }
        }
    }

    private static async _deleteAssets(githubEndpoint: string, repositoryName: string, assets: any[]) {
        for (let asset of assets) {
            let deleteAssetResponse = await Release.deleteReleaseAsset(githubEndpoint, repositoryName, asset.id);

            if (deleteAssetResponse.statusCode === 204) {
                console.log(tl.loc("AssetDeletedSuccessfully", asset));
            }
            else {
                tl.debug("Delete asset response:\n" + JSON.stringify(deleteAssetResponse));
                throw new Error(tl.loc("ErrorDeletingAsset", asset));
            }
        }
    }

    private static readonly _uploadUrlkey: string = "upload_url";
    private static readonly _htmlUrlkey: string = "html_url";
    private static readonly _assetsKey: string = "assets";
}

export class ActionType {
    public static readonly create = "Create";
    public static readonly edit = "Edit";
    public static readonly discard = "Discard";
}