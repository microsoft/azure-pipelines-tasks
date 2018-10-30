import tl = require("vsts-task-lib/task");
import path = require("path");
import { WebResponse } from "./webClient";
import { createRelease } from "./CreateRelease";
import { uploadReleaseAsset } from "./UploadReleaseAsset";
import { validateUploadAssets, getUploadAssets } from "./Utility";
import { EditRelease } from "./EditRelease";
import { DiscardRelease } from "./DiscardRelease";
import { deleteReleaseAsset } from "./DeleteReleaseAsset";

export async function createReleaseAction(): Promise<void> {

    try {
        validateUploadAssets(); 
        let response: WebResponse = await createRelease();

        if (response.statusCode === 201) {
            const uploadUrl: string = response.body["upload_url"];
            await uploadAssets(uploadUrl, []);
        }
        else {            
            throw new Error(tl.loc("ErrorCreateRelease") + "\n" + JSON.stringify(response));
        }

        tl.setResult(tl.TaskResult.Succeeded, "");
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }    
}

export async function editReleaseAction(): Promise<void> {
    
    try {
        validateUploadAssets();        
        let response: WebResponse = await EditRelease();

        if (response.statusCode === 200) {
            const uploadUrl: string = response.body["upload_url"];
            await uploadAssets(uploadUrl, response.body["assets"]);
        }
        else {
            throw new Error(tl.loc("ErrorEditRelease") + "\n" + JSON.stringify(response));
        }

        tl.setResult(tl.TaskResult.Succeeded, "");
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }    
}

export async function discardReleaseAction(): Promise<void> {

    try {
        let response: WebResponse = await DiscardRelease();

        if (response.statusCode === 204) {
            console.log(tl.loc("DiscardReleaseSuccessful"));
        }
        else {
            throw new Error(tl.loc("ErrorDiscardingRelease") + "\n" + JSON.stringify(response));
        }

        tl.setResult(tl.TaskResult.Succeeded, "");
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }    
}

async function uploadAssets(uploadUrl: string, existingAssets) {
    const deleteExistingAssets: boolean = tl.getBoolInput('deleteExistingAssets');
    let assets: string[] = getUploadAssets();

    for (let index = 0; index < assets.length; index++) {

        const asset = assets[index];
        let uploadResponse = await uploadReleaseAsset(uploadUrl, asset);
        
        if (uploadResponse.statusCode === 201) {
            console.log(tl.loc("UploadAssetSuccessful", asset));
        }
        else if (uploadResponse.statusCode === 422 && uploadResponse.body.errors && uploadResponse.body.errors[0].code === 'already_exists') {
            
            if (deleteExistingAssets) {
                console.log(tl.loc("DuplicateAssetFound", asset));
                console.log(tl.loc("DeletingDuplicateAsset", asset));
                const fileName = path.basename(asset);

                for (let existingAsset of existingAssets) {
                    if (fileName === existingAsset.name) {
                        let deleteAssetResponse = await deleteReleaseAsset(existingAsset.id);

                        if (deleteAssetResponse.statusCode === 204) {
                            console.log(tl.loc("DuplicateAssetDeletedSuccessfully", asset));
                        }
                        else {
                            throw new Error(tl.loc("ErrorDeletingDuplicateAsset", asset) + "\n" + JSON.stringify(deleteAssetResponse));
                        }
                        index--;
                        break;
                    }
                }
            }
            else {
                throw new Error(tl.loc("DuplicateAssetFound", asset) + "\n" + JSON.stringify(uploadResponse));
            }
        }
        else {
            throw new Error(tl.loc("ErrorUploadingAsset") + "\n" + JSON.stringify(uploadResponse));
        }
    }
}