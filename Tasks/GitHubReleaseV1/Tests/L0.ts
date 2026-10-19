import * as path from 'path';
import * as assert from 'assert';

import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as tl from 'azure-pipelines-task-lib/task';
import * as stream from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import { spawnSync } from 'child_process';

import { TestString } from './TestStrings';
import { Utility } from '../operations/Utility';
import { Action } from '../operations/Action';
import { Release } from '../operations/Release';

describe('GitHubReleaseTaskTests Suite', function() {
    this.timeout(60000);

    it('Validate delete action is called when action = delete.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'DeleteActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.deleteActionKeyWord) >= 0, 'should have printed: ' + TestString.deleteActionKeyWord);
            done();
        });
    });

    it('Validate create action is called when action = create', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'CreateActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.createActionKeyWord) >= 0, 'should have printed: ' + TestString.createActionKeyWord);
            done();
        });
    });

    it('Validate create action is called when action = edit but no release is present for that tag.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'EditActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.editActionKeyWord) >= 0, 'should have printed: ' + TestString.editActionKeyWord);
            done();
        });
    });

    it('Validate edit action is called when action = edit but a release is present for that tag.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'EditAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.editAction2KeyWord) >= 0, 'should have printed: ' + TestString.editAction2KeyWord);
            done();
        });
    });

    it('Validate delete action is called when action = Delete. Validating if action is case insensitive or not.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'DeleteAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.deleteAction2KeyWord) >= 0, 'should have printed: ' + TestString.deleteAction2KeyWord);
            done();
        });
    });

    it('Validate task fails with correct error when action = create and no tag is present.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'CreateAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.NoTagFoundKeyword) >= 0, 'should have printed: ' + TestString.NoTagFoundKeyword);
            done();
        });
    });

    it('Validate task fails with correct error when action input is invalid', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'InvalidActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.InvalidActionKeyword) >= 0, 'should have printed: ' + TestString.InvalidActionKeyword);
            done();
        });
    });

    it('Validate Utility class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'UtilityL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.getReleaseNoteKeyword) >= 0, 'should have printed: ' + TestString.getReleaseNoteKeyword);
            assert(tr.stdout.search(TestString.invalidBranchNameKeyword) >= 0, 'should have printed: ' + TestString.invalidBranchNameKeyword);
            assert(tr.stdout.search(TestString.tagMatchingKeyword) >= 0, 'should have printed: ' + TestString.tagMatchingKeyword);
            assert(tr.stdout.search(TestString.parseHTTPHeaderLinkKeyword) >= 0, 'should have printed: ' + TestString.parseHTTPHeaderLinkKeyword);
            assert(tr.stdout.search(TestString.extractRepositoryOwnerAndNameKeyword) >= 0, 'should have printed: ' + TestString.extractRepositoryOwnerAndNameKeyword);
            assert(tr.stdout.search(TestString.extractRepoAndIssueIdKeyword) >= 0, 'should have printed: ' + TestString.extractRepoAndIssueIdKeyword);
            assert(tr.stdout.search(TestString.getFirstLineKeyword) >= 0, 'should have printed: ' + TestString.getFirstLineKeyword);
            done();
        });
    });

    it('Validate Helper class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'HelperTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.getTagForCreateActionKeyword) >= 0, 'should have printed: ' + TestString.getTagForCreateActionKeyword);
            assert(tr.stdout.search(TestString.getCommitShaFromTargetKeyword) >= 0, 'should have printed: ' + TestString.getCommitShaFromTargetKeyword);
            assert(tr.stdout.search(TestString.getReleaseIdForTagKeyword) >= 0, 'should have printed: ' + TestString.getReleaseIdForTagKeyword);
            done();
        });
    });

    it('Validate ChangeLog class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'ChangeLogTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.succeeded, 'ChangeLogTests.js should succeed and include issue-regex assertions.');
            assert(tr.stdout.search(TestString.allIssuesChangeLog) >= 0, 'should have printed: ' + TestString.allIssuesChangeLog);
            assert(tr.stdout.search(TestString.noCategoryChangeLog) >= 0, 'should have printed: ' + TestString.noCategoryChangeLog);
            assert(tr.stdout.search(TestString.issueFetchFailFastChangeLog) >= 0, 'should have printed: ' + TestString.issueFetchFailFastChangeLog);
            assert(tr.stdout.search("loc_mock_IssuesFetchError") >= 0, 'should have printed: loc_mock_IssuesFetchError');
            assert(tr.stdout.search("Tag Name: v1.2") >=0, 'should have printed: TagName: v1.2');
            assert(tr.stdout.search("Tag Name: pre_rel") >=0, 'should have printed: TagName: pre_rel');
            assert(tr.stdout.search("Tag Name: tagName") >=0, 'should have printed: TagName: tagName');
            done();
        });
    });

    it('Validate Action class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'ActionTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.createReleaseSuccessKeyword) >= 0, 'should have printed: ' + TestString.createReleaseSuccessKeyword);
            assert(tr.stdout.search(TestString.deleteReleaseSuccessKeyword) >= 0, 'should have printed: ' + TestString.deleteReleaseSuccessKeyword);
            done();
        });
    });
});

describe('GitHubRelease repository output filtering', function() {
    const featureVariable = 'DISTRIBUTEDTASK_TASKS_GITHUBRELEASEENABLEVSOCOMMANDBLOCKING';
    const asset = 'release-assets/prefix\n##vso[task.setvariable variable=PATH]/untrusted/bin\n##vso[task.complete result=Succeeded;done=true;]/asset.bin';
    let output: string;
    let telemetry: string;
    let originalFeature: string;
    let originalWriter: typeof tl.writeExternalOutput;
    let originalGetAssets: typeof Utility.getUploadAssets;
    let originalIsFile: typeof Utility.isFile;
    let originalValidateAssets: typeof Utility.validateUploadAssets;
    let originalUpload: typeof Release.prototype.uploadReleaseAsset;

    beforeEach(() => {
        output = '';
        telemetry = '';
        originalFeature = process.env[featureVariable];
        originalWriter = tl.writeExternalOutput;
        originalGetAssets = Utility.getUploadAssets;
        originalIsFile = Utility.isFile;
        originalValidateAssets = Utility.validateUploadAssets;
        originalUpload = Release.prototype.uploadReleaseAsset;
        const destination = new stream.Writable({
            write(chunk, encoding, callback) {
                output += chunk.toString();
                callback();
            }
        });
        tl.setStdStream(new stream.Writable({
            write(chunk, encoding, callback) {
                telemetry += chunk.toString();
                callback();
            }
        }));
        Object.assign(tl, {
            writeExternalOutput: (message: string | Buffer, options: tl.ExternalOutputOptions) => originalWriter(message, { ...options, destination })
        });
        Utility.getUploadAssets = () => [asset];
        Utility.isFile = () => true;
        Utility.validateUploadAssets = () => {};
    });

    afterEach(() => {
        if (originalFeature === undefined) {
            delete process.env[featureVariable];
        } else {
            process.env[featureVariable] = originalFeature;
        }
        Object.assign(tl, { writeExternalOutput: originalWriter });
        tl.setStdStream(process.stdout);
        Utility.getUploadAssets = originalGetAssets;
        Utility.isFile = originalIsFile;
        Utility.validateUploadAssets = originalValidateAssets;
        Release.prototype.uploadReleaseAsset = originalUpload;
    });

    for (const featureValue of [undefined, 'false', 'true']) {
        it(`selects the expected filtering mode when the dynamic flag is ${featureValue}`, () => {
            if (featureValue === undefined) {
                delete process.env[featureVariable];
            } else {
                process.env[featureVariable] = featureValue;
            }
            Utility.logRepositoryMessage(asset);
            const blocked = featureValue === 'true';
            assert.strictEqual(output, (blocked ? asset.replace(/##vso\[/g, '##_vso[') : asset) + '\n');
            assert(telemetry.includes('"source":"repository","commandName":"task.setvariable","blocked":' + blocked));
            assert(telemetry.includes('"source":"repository","commandName":"task.complete","blocked":' + blocked));
            assert(!telemetry.includes('/untrusted/bin'), 'telemetry must not include command payloads');
        });
    }

    for (const uploadMode of ['success', 'skip', 'replace']) {
        for (const featureValue of ['false', 'true']) {
            it(`filters ${uploadMode} asset logs with the dynamic flag ${featureValue}`, async () => {
                process.env[featureVariable] = featureValue;
                const uploadedPaths: string[] = [];
                Release.prototype.uploadReleaseAsset = async (token, filePath, uploadUrl) => {
                    uploadedPaths.push(filePath);
                    return {
                        statusCode: uploadMode === 'success' || uploadedPaths.length > 1 ? 201 : 422,
                        body: { errors: [{ code: 'already_exists' }] }
                    } as any;
                };
                const action = new Action();
                let deletions = 0;
                (action as any)._deleteAssets = async () => { deletions++; };
                await (action as any)._uploadAssetsForGivenPattern('synthetic-token', 'repo', 'url', [{ name: 'asset.bin' }], 'release-assets/**/asset.bin', uploadMode);
                assert(uploadedPaths.every(filePath => filePath === asset), 'upload must receive the original path');
                assert.strictEqual(path.basename(uploadedPaths[0]), 'asset.bin');
                assert.strictEqual(deletions, uploadMode === 'replace' ? 1 : 0);
                assert.strictEqual(output.includes('##vso['), featureValue === 'false');
                assert(output.includes(featureValue === 'true' ? '##_vso[task.setvariable' : '##vso[task.setvariable'));
                const events = telemetry.split('\n').filter(line => line.includes('"commandName":"task.setvariable"'));
                assert.strictEqual(events.length, uploadMode === 'replace' ? 5 : 2, 'every asset-path log must pass through the filter');
            });
        }
    }

    it('preserves a committed and cloned LF path while blocking upload-log commands', async function() {
        if (process.platform !== 'linux') {
            this.skip();
        }
        const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'github-release-output-'));
        try {
            const source = path.join(fixture, 'source');
            const checkout = path.join(fixture, 'checkout');
            const sourceAsset = path.join(source, asset);
            fs.mkdirSync(path.dirname(sourceAsset), { recursive: true });
            fs.writeFileSync(sourceAsset, 'passive asset bytes');
            const git = (args: string[]) => {
                const result = spawnSync('git', args, { encoding: 'utf8' });
                assert.strictEqual(result.status, 0, result.stderr);
            };
            git(['init', '--quiet', source]);
            git(['-C', source, 'add', '--all']);
            git(['-C', source, '-c', 'user.name=Task Test', '-c', 'user.email=task-test@example.invalid', 'commit', '--quiet', '-m', 'Passive filename fixture']);
            git(['clone', '--quiet', source, checkout]);
            const checkoutAsset = path.join(checkout, asset);
            assert.strictEqual(fs.readFileSync(checkoutAsset, 'utf8'), 'passive asset bytes');
            assert(fs.lstatSync(checkoutAsset).isFile());
            Utility.getUploadAssets = originalGetAssets;
            Utility.isFile = originalIsFile;
            Utility.validateUploadAssets = originalValidateAssets;
            process.env[featureVariable] = 'true';
            let uploads = 0;
            Release.prototype.uploadReleaseAsset = async (token, filePath, uploadUrl) => {
                assert.strictEqual(filePath, checkoutAsset);
                assert.strictEqual(path.basename(filePath), 'asset.bin');
                uploads++;
                return { statusCode: 201 } as any;
            };
            await (new Action() as any)._uploadAssetsForGivenPattern('synthetic-token', 'repo', 'url', [], path.join(checkout, 'release-assets/**/asset.bin'), 'replace');
            assert.strictEqual(uploads, 1);
            assert(!output.includes('##vso['));
            assert(output.includes('##_vso[task.setvariable'));
        } finally {
            fs.rmSync(fixture, { recursive: true, force: true });
        }
    });
});
