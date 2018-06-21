import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'vsts-task-lib/mock-test';

describe('AndroidSigning Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    before(() => {
    });

    after(() => {
    });

    it('Do not sign or zipalign if nothing is selected', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0AndroidSkipSignAlign.js');
        let taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        taskRunner.run();

        assert(taskRunner.invokedToolCount === 0, 'should not run anything');
        assert(taskRunner.stderr.length === 0, 'should not have written to stderr');
        assert(taskRunner.succeeded, 'task should have succeeded');

        done();
    });

    it('Do not align or sign if input single file does not exist', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0AndroidSignAlignNoFileInput.js');
        let taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        taskRunner.run();

        assert(taskRunner.invokedToolCount === 0, 'should not run anything');
        assert(taskRunner.errorIssues.length || taskRunner.stderr.length > 0, 'should have written to stderr');
        assert(taskRunner.failed, 'task should have failed');

        done();
    });

    it('Do not align or sign if input pattern does not match any files', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0AndroidSignAlignNoMatchingFileInput.js');
        let taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        taskRunner.run();

        assert(taskRunner.invokedToolCount === 0, 'should not run anything');
        assert(taskRunner.errorIssues.length > 0 || taskRunner.stderr.length > 0, 'should have written to stderr');
        assert(taskRunner.failed, 'task should have failed');

        done();
    });

    it('Use jarsigner from PATH before searching in JAVA_HOME', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0AndroidSignAlignJarsignerFromPath.js');
        let taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        taskRunner.run();

        assert(taskRunner.invokedToolCount == 1, 'should have run jarsigner');
        assert(taskRunner.stderr.length == 0, 'should have jarsigned file');
        assert(taskRunner.succeeded, 'task should have succeeded');

        done();
    });

    it('Fail if jarsigner is not on PATH and JAVA_HOME is not set', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0AndroidSignAlignFailJarsignerNotFound.js');
        let taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        taskRunner.run();

        assert(taskRunner.invokedToolCount == 0, 'should not run anything');
        assert(taskRunner.errorIssues.length > 0 || taskRunner.stderr.length > 0, 'should have failed to locate jarsigner');
        assert(taskRunner.failed, 'task should have failed');

        done();
    });

    it('Fail if ANDROID_HOME is not set', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0AndroidSignAlignAndroidHomeNotSet.js');
        let taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        taskRunner.run();

        assert(taskRunner.invokedToolCount == 0, 'should not run anything');
        assert(taskRunner.errorIssues.length > 0 || taskRunner.stderr.length > 0, 'should have jarsigned file');
        assert(taskRunner.failed, 'task should have failed');

        done();
    });

    it('Signing a single file', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0AndroidSignSingleFile.js');
        let taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        taskRunner.run();

        assert(taskRunner.invokedToolCount === 1, 'should run jarsigner');
        assert(taskRunner.errorIssues.length === 0 && taskRunner.stderr.length === 0, 'should not have written to stderr');
        assert(taskRunner.succeeded, 'task should have succeeded');

        done();
    });

    it('zipalign a single file', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0AndroidZipalignSingleFile.js');
        let taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        taskRunner.run();

        assert(taskRunner.invokedToolCount === 1, 'should run zipalign');
        assert(taskRunner.stderr.length === 0 || taskRunner.errorIssues.length === 0, 'should not have written to stderr');
        assert(taskRunner.succeeded, 'task should have succeeded');

        done();
    });

    it('Signing and aligning multiple files', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0AndroidSignAlignMultipleFiles.js');
        let taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        taskRunner.run();

        assert(taskRunner.invokedToolCount === 4, 'should have run jarsigner and zipalign twice each');
        assert(taskRunner.stderr.length === 0 || taskRunner.errorIssues.length === 0, 'should not have written to stderr');
        assert(taskRunner.succeeded, 'task should have succeeded');

        done();
    });

    it('Download keystore file from SecureFile', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0DownloadKeystoreFile.js');
        let taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        taskRunner.run();

        assert(taskRunner.stderr.length === 0, 'should not have written to stderr');
        assert(taskRunner.succeeded, 'task should have succeeded');

        done();
    });
});
