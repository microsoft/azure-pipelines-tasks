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

    it('Do not sign or zipalign if nothing is selected', (done: MochaDone) => {
        this.timeout(1000);

        const tp: string = path.join(__dirname, 'L0AndroidSkipSignAlign.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Do not align or sign if input single file does not exist', (done: MochaDone) => {
        this.timeout(1000);

        const tp: string = path.join(__dirname, 'L0AndroidSignAlignNoFileInput.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.errorIssues.length || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('Do not align or sign if input pattern does not match any files', (done: MochaDone) => {
        this.timeout(1000);

        const tp: string = path.join(__dirname, 'L0AndroidSignAlignNoMatchingFileInput.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('Fail if ANDROID_HOME is not set', (done: MochaDone) => {
        this.timeout(1000);

        const tp: string = path.join(__dirname, 'L0AndroidSignAlignAndroidHomeNotSet.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount === 0, 'should not run anything');
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have failed locate the tools');
        assert(tr.failed, 'task should have failed');

        done();
    });

    it('Use apksigner in ANDROID_HOME to sign single file', (done: MochaDone) => {
        this.timeout(1000);

        const tp: string = path.join(__dirname, 'L0AndroidSignAlignApksignerFromAndroidHome.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount === 1, 'should have run apksigner');
        assert(tr.stderr.length === 0, 'should have signed file');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Use specified apksigner to sign a single file', (done: MochaDone) => {
        this.timeout(1000);

        const tp: string = path.join(__dirname, 'L0AndroidSignAlignApksignerFromInputSingleFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount === 1, 'should run apksigner');
        assert(tr.errorIssues.length === 0 && tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('zipalign a single file', (done: MochaDone) => {
        this.timeout(1000);

        const tp: string = path.join(__dirname, 'L0AndroidZipalignSingleFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount === 1, 'should run zipalign');
        assert(tr.stderr.length === 0 || tr.errorIssues.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Signing and aligning multiple files', (done: MochaDone) => {
        this.timeout(1000);

        const tp: string = path.join(__dirname, 'L0AndroidSignAlignMultipleFiles.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount === 4, 'should have run apksigner and zipalign twice each');
        assert(tr.stderr.length === 0 || tr.errorIssues.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Download keystore file from SecureFile', (done: MochaDone) => {
        this.timeout(1000);

        const tp: string = path.join(__dirname, 'L0DownloadKeystoreFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
});
