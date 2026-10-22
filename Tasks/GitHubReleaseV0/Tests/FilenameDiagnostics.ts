import * as assert from 'assert';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { Action } from '../operations/Action';
import { Release } from '../operations/Release';
import { Utility } from '../operations/Utility';
import { WebResponse } from '../operations/webClient';

describe('GitHubRelease filename diagnostics', () => {
    for (const asset of ['release-assets/ordinary asset.bin', 'release-assets/prefix\n##vso[test]/##[test]/asset.bin']) {
        for (const mode of ['success', 'skip', 'replace']) {
            it(`preserves upload paths and formats ${mode} diagnostics for ${asset}`, async () => {
                const originalLog = console.log;
                const originalLoc = tl.loc;
                const originalInput = tl.getInput;
                const originalGetAssets = Utility.getUploadAssets;
                const originalIsFile = Utility.isFile;
                const originalValidate = Utility.validateUploadAssets;
                const originalEdit = Release.prototype.editRelease;
                const originalCreate = Release.prototype.createRelease;
                const originalUpload = Release.prototype.uploadReleaseAsset;
                const originalDelete = Release.prototype.deleteReleaseAsset;
                const messages: string[] = [];
                const uploads: string[] = [];
                let deletions = 0;
                try {
                    console.log = (message: string) => messages.push(message);
                    Object.assign(tl, {
                        loc: (key: string, ...args: string[]) => `${key}: ${args.join(' ')}`,
                        getInput: () => mode === 'skip' ? 'delete' : 'replace'
                    });
                    Utility.getUploadAssets = () => [asset];
                    Utility.isFile = () => true;
                    Utility.validateUploadAssets = () => {};
                    Release.prototype.editRelease = async () => Object.assign(new WebResponse(), {
                        statusCode: 200,
                        body: { upload_url: 'url', assets: [{ name: path.basename(asset), id: 'asset-id' }] }
                    });
                    Release.prototype.createRelease = async () => Object.assign(new WebResponse(), {
                        statusCode: 201,
                        body: { upload_url: 'url' }
                    });
                    Release.prototype.uploadReleaseAsset = async (token, filePath) => {
                        uploads.push(filePath);
                        return Object.assign(new WebResponse(), {
                            statusCode: mode === 'success' || uploads.length > 1 ? 201 : 422,
                            body: { errors: [{ code: 'already_exists' }] }
                        });
                    };
                    Release.prototype.deleteReleaseAsset = async () => {
                        deletions++;
                        return Object.assign(new WebResponse(), { statusCode: 204 });
                    };
                    if (mode === 'skip') {
                        await new Action().createReleaseAction('token', 'repo', 'target', 'tag', 'title', 'notes', false, false, ['assets/**']);
                    } else {
                        await new Action().editReleaseAction('token', 'repo', 'target', 'tag', 'title', 'notes', false, false, ['assets/**'], 'id');
                    }
                    assert.strictEqual(uploads.length, mode === 'replace' ? 2 : 1);
                    assert(uploads.every(filePath => filePath === asset));
                    assert.strictEqual(deletions, mode === 'replace' ? 1 : 0);
                    const display = asset.replace(/##vso\[/gi, '##_vso[').replace(/##\[/g, '##_[');
                    const keys = mode === 'success' ? ['UploadingAsset', 'UploadAssetSuccess']
                        : mode === 'skip' ? ['UploadingAsset', 'SkipDuplicateAssetFound']
                        : ['UploadingAsset', 'DuplicateAssetFound', 'DeletingDuplicateAsset', 'UploadAssetSuccess'];
                    for (const key of keys) {
                        assert(messages.includes(`${key}: ${display}`), `Missing safe ${key} diagnostic`);
                    }
                } finally {
                    console.log = originalLog;
                    Object.assign(tl, { loc: originalLoc, getInput: originalInput });
                    Utility.getUploadAssets = originalGetAssets;
                    Utility.isFile = originalIsFile;
                    Utility.validateUploadAssets = originalValidate;
                    Release.prototype.editRelease = originalEdit;
                    Release.prototype.createRelease = originalCreate;
                    Release.prototype.uploadReleaseAsset = originalUpload;
                    Release.prototype.deleteReleaseAsset = originalDelete;
                }
            });
        }
    }
});
