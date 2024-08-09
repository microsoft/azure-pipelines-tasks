import * as fs from 'fs';
import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AndroidSigning Suite v3', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    before(() => {
        // empty
    });

    after(() => {
        // empty
    });

    it('Do not sign or zipalign if nothing is selected', async () => {
        const tp: string = path.join(__dirname, 'L0AndroidSkipSignAlign.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Do not align or sign if input single file does not exist', async () => {
        const tp: string = path.join(__dirname, 'L0AndroidSignAlignNoFileInput.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.errorIssues.length || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.failed, 'task should have failed');
    });

    it('Do not align or sign if input pattern does not match any files', async () => {
        const tp: string = path.join(__dirname, 'L0AndroidSignAlignNoMatchingFileInput.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.failed, 'task should have failed');
    });

    it('Fail if ANDROID_HOME is not set', async () => {
        const tp: string = path.join(__dirname, 'L0AndroidSignAlignAndroidHomeNotSet.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have failed locate the tools');
        assert(tr.failed, 'task should have failed');
    });

    it('Use apksigner in ANDROID_HOME to sign single file', async () => {
        const tp: string = path.join(__dirname, 'L0AndroidSignAlignApksignerFromAndroidHome.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 1, 'should have run apksigner');
        assert(tr.stderr.length === 0, 'should have signed file');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Use specified apksigner to sign a single file', async () => {
        const tp: string = path.join(__dirname, 'L0AndroidSignAlignApksignerFromInputSingleFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 1, 'should run apksigner');
        assert(tr.errorIssues.length === 0 && tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('zipalign a single file', async () => {
        const tp: string = path.join(__dirname, 'L0AndroidZipalignSingleFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 1, 'should run zipalign');
        assert(tr.stderr.length === 0 || tr.errorIssues.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Signing and aligning multiple files', async () => {
        const tp: string = path.join(__dirname, 'L0AndroidSignAlignMultipleFiles.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount === 4, 'should have run apksigner and zipalign twice each');
        assert(tr.stderr.length === 0 || tr.errorIssues.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Download keystore file from SecureFile', async () => {
        const tp: string = path.join(__dirname, 'L0DownloadKeystoreFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Should use the latest apksign', async function () {
        const tp: string = path.join(__dirname, 'L0UseLatestApksign.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert.strictEqual(tr.stderr.length, 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Should use specified version of apksign', async function () {
        const tp: string = path.join(__dirname, 'L0UseSpecifiedApksign.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert.strictEqual(tr.stderr.length, 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Should not find specified version of apksign', async function () {
        const tp: string = path.join(__dirname, 'L0CantFindSpecifiedApksign.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('CouldNotFindVersionOfToolInAndroidHome'), 'Should have written error message');
        assert(tr.failed, 'task should have failed');
    });
});
