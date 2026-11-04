import * as assert from 'assert';
import * as path from 'path';
import * as stream from 'stream';
import * as tl from 'azure-pipelines-task-lib/task';
import { Action } from '../operations/Action';
import { Release } from '../operations/Release';
import { Utility } from '../operations/Utility';
import { WebResponse } from '../operations/webClient';

describe('GitHubRelease filename diagnostics', () => {
    const featureVariable = 'DISTRIBUTEDTASK_TASKS_ENABLEVSOCOMMANDBLOCKINGRMTASKS';
    for (const featureValue of [undefined, 'false', 'true']) {
    for (const asset of ['release-assets/ordinary asset.bin', 'release-assets/prefix\n##vso[task.setvariable variable=example]value/##[test]/asset.bin']) {
        for (const mode of ['success', 'skip', 'replace']) {
            it(`preserves upload paths and formats ${mode} diagnostics for ${asset}, flag=${featureValue}`, async () => {
                const originalFeature = process.env[featureVariable];
                const originalWriter = tl.writeExternalOutput;
                const originalLoc = tl.loc;
                const originalInput = tl.getInput;
                const originalGetAssets = Utility.getUploadAssets;
                const originalIsFile = Utility.isFile;
                const originalValidate = Utility.validateUploadAssets;
                const originalEdit = Release.prototype.editRelease;
                const originalCreate = Release.prototype.createRelease;
                const originalUpload = Release.prototype.uploadReleaseAsset;
                const originalDelete = Release.prototype.deleteReleaseAsset;
                let output = '';
                let telemetry = '';
                const destination = new stream.Writable({
                    write(chunk, encoding, callback) {
                        output += chunk.toString();
                        callback();
                    }
                });
                const uploads: string[] = [];
                let deletions = 0;
                try {
                    if (featureValue === undefined) {
                        delete process.env[featureVariable];
                    } else {
                        process.env[featureVariable] = featureValue;
                    }
                    tl.setStdStream(new stream.Writable({
                        write(chunk, encoding, callback) {
                            telemetry += chunk.toString();
                            callback();
                        }
                    }));
                    Object.assign(tl, {
                        writeExternalOutput: (message: string | Buffer, options: tl.ExternalOutputOptions) => originalWriter(message, { ...options, destination }),
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
                    const blocked = featureValue === 'true';
                    const display = blocked ? asset.split('##vso[').join('##_vso[') : asset;
                    const keys = mode === 'success' ? ['UploadingAsset', 'UploadAssetSuccess']
                        : mode === 'skip' ? ['UploadingAsset', 'SkipDuplicateAssetFound']
                        : ['UploadingAsset', 'DuplicateAssetFound', 'DeletingDuplicateAsset', 'UploadAssetSuccess'];
                    for (const key of keys) {
                        assert(output.includes(`${key}: ${display}\n`), `Missing ${key} diagnostic with newline framing`);
                    }
                    const events = telemetry.split('\n').filter(line => line.includes('"commandName":"task.setvariable"'));
                    assert.strictEqual(events.length, asset.includes('##vso[') ? (mode === 'replace' ? 5 : 2) : 0);
                    for (const event of events) {
                        assert(event.includes('"source":"repository"'));
                        assert(event.includes('"blocked":' + blocked));
                        assert(!event.includes('variable=example'), 'telemetry must not contain payloads');
                    }
                } finally {
                    if (originalFeature === undefined) {
                        delete process.env[featureVariable];
                    } else {
                        process.env[featureVariable] = originalFeature;
                    }
                    tl.setStdStream(process.stdout);
                    Object.assign(tl, { loc: originalLoc, getInput: originalInput, writeExternalOutput: originalWriter });
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
    }

    it('uses exact task-lib marker matching without changing newlines or formatting markers', () => {
        const originalFeature = process.env[featureVariable];
        const originalWriter = tl.writeExternalOutput;
        let output = '';
        const destination = new stream.Writable({
            write(chunk, encoding, callback) {
                output += chunk.toString();
                callback();
            }
        });
        try {
            process.env[featureVariable] = 'true';
            Object.assign(tl, {
                writeExternalOutput: (message: string | Buffer, options: tl.ExternalOutputOptions) =>
                    originalWriter(message, { ...options, destination })
            });
            Utility.logRepositoryMessage('prefix ##vso[test]\r\n##VsO[test]\n##[command]text');
            assert.strictEqual(output, 'prefix ##_vso[test]\r\n##VsO[test]\n##[command]text\n');
        } finally {
            if (originalFeature === undefined) {
                delete process.env[featureVariable];
            } else {
                process.env[featureVariable] = originalFeature;
            }
            Object.assign(tl, { writeExternalOutput: originalWriter });
        }
    });
});
