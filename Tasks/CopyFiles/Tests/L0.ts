import * as assert from 'assert';
import * as mocktest from 'vsts-task-lib/mock-test';
import * as os from 'os';
import * as path from 'path';

describe('CopyFiles L0 Suite', function () {
    before(() => { });

    after(() => { });

    it('copy files from srcdir to destdir', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0copyAllFiles.js');
        let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
        runner.run();

        assert(
            runner.succeeded,
            'should have succeeded');
        assert(
            runner.stdOutContained(`creating path: /destDir`),
            'should have mkdirP destDir');
        assert(
            runner.stdOutContained(`creating path: ${path.join('/destDir', 'someOtherDir')}`),
            'should have mkdirP someOtherDir');
        assert(
            runner.stdOutContained(`creating path: ${path.join('/destDir', 'someOtherDir2')}`),
            'should have mkdirP someOtherDir2');
        assert(
            !runner.stdOutContained(`creating path: ${path.join('/destDir', 'someOtherDir3')}`),
            'should not have mkdirP someOtherDir3');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir/file1.file to ${path.join('/destDir', 'someOtherDir', 'file1.file')}`),
            'should have copied dir1 file1');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir/file2.file to ${path.join('/destDir', 'someOtherDir', 'file2.file')}`),
            'should have copied dir1 file2');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir2/file1.file to ${path.join('/destDir', 'someOtherDir2', 'file1.file')}`),
            'should have copied dir2 file1');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir2/file2.file to ${path.join('/destDir', 'someOtherDir2', 'file2.file')}`),
            'should have copied dir2 file2');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir2/file3.file to ${path.join('/destDir', 'someOtherDir2', 'file3.file')}`),
            'should have copied dir2 file3');
        done();
    });

    it('copy files and subtract based on exclude pattern', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0copySubtractExclude.js');
        let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
        runner.run();

        assert(
            runner.succeeded,
            'should have succeeded');
        assert(
            runner.stdOutContained(`creating path: /destDir`),
            'should have mkdirP destDir');
        assert(
            runner.stdOutContained(`creating path: ${path.join('/destDir', 'someOtherDir')}`),
            'should have mkdirP someOtherDir');
        assert(
            !runner.stdOutContained(`creating path: ${path.join('/destDir', 'someOtherDir2')}`),
            'should not have mkdirP someOtherDir2');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir/file1.file to ${path.join('/destDir', 'someOtherDir', 'file1.file')}`),
            'should have copied dir1 file1');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir/file2.file to ${path.join('/destDir', 'someOtherDir', 'file2.file')}`),
            'should have copied dir1 file2');
        assert(
            !runner.stdOutContained(`copying /srcDir/someOtherDir2/file1.file to ${path.join('/destDir', 'someOtherDir2', 'file1.file')}`),
            'should not have copied dir2 file1');
        done();
    });

    it('fails if Contents not set', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0failsIfContentsNotSet.js');
        let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
        runner.run();

        assert(runner.failed, 'should have failed');
        assert(runner.createdErrorIssue('Unhandled: Input required: Contents'), 'should have created error issue');
        done();
    });

    it('fails if SourceFolder not set', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0failsIfSourceFolderNotSet.js');
        let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
        runner.run();

        assert(runner.failed, 'should have failed');
        assert(runner.createdErrorIssue('Unhandled: Input required: SourceFolder'), 'should have created error issue');
        done();
    });

    it('fails if TargetFolder not set', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0failsIfTargetFolderNotSet.js');
        let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
        runner.run();

        assert(runner.failed, 'should have failed');
        assert(runner.createdErrorIssue('Unhandled: Input required: TargetFolder'), 'should have created error issue');
        done();
    });

    it('fails if SourceFolder not found', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0failsIfSourceFolderNotFound.js');
        let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
        runner.run();

        assert(runner.failed, 'should have failed');
        assert(runner.createdErrorIssue('Unhandled: Not found /srcDir'), 'should have created error issue');
        done();
    });

    it('fails if target file is a directory', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0failsIfTargetFileIsDir.js');
        let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
        runner.run();

        assert(runner.failed, 'should have failed');
        assert(runner.createdErrorIssue('Error: loc_mock_TargetIsDir'), 'should have created error issue');
        done();
    });

    it('skips if exists', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0skipsIfExists.js');
        let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
        runner.run();

        assert(
            runner.succeeded,
            'should have succeeded');
        assert(
            runner.stdOutContained(`creating path: /destDir`),
            'should have mkdirP destDir');
        assert(
            runner.stdOutContained(`creating path: ${path.join('/destDir', 'someOtherDir')}`),
            'should have mkdirP someOtherDir');
        assert(
            !runner.stdOutContained(`copying /srcDir/someOtherDir/file1.file to ${path.join('/destDir', 'someOtherDir', 'file1.file')}`),
            'should not have copied file1');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir/file2.file to ${path.join('/destDir', 'someOtherDir', 'file2.file')}`),
            'should have copied file2');
        done();
    });

    it('overwrites if specified', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0overwritesIfSpecified.js');
        let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
        runner.run();

        assert(
            runner.succeeded,
            'should have succeeded');
        assert(
            runner.stdOutContained(`creating path: /destDir`),
            'should have mkdirP destDir');
        assert(
            runner.stdOutContained(`creating path: ${path.join('/destDir', 'someOtherDir')}`),
            'should have mkdirP someOtherDir');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir/file1.file to ${path.join('/destDir', 'someOtherDir', 'file1.file')}`),
            'should have copied file1');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir/file2.file to ${path.join('/destDir', 'someOtherDir', 'file2.file')}`),
            'should have copied file2');
        done();
    });

    it('cleans if specified', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0cleansIfSpecified.js');
        let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
        runner.run();

        assert(
            runner.succeeded,
            'should have succeeded');
        assert(
            runner.stdOutContained('rmRF /destDir'),
            'should have cleaned destDir');
        assert(
            runner.stdOutContained(`creating path: /destDir`),
            'should have mkdirP destDir');
        assert(
            runner.stdOutContained(`creating path: ${path.join('/destDir', 'someOtherDir')}`),
            'should have mkdirP someOtherDir');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir/file1.file to ${path.join('/destDir', 'someOtherDir', 'file1.file')}`),
            'should have copied file1');
        assert(
            runner.stdOutContained(`copying /srcDir/someOtherDir/file2.file to ${path.join('/destDir', 'someOtherDir', 'file2.file')}`),
            'should have copied file2');
        done();
    });

    if (process.platform == 'win32') {
        it('overwrites readonly', (done: MochaDone) => {
            this.timeout(1000);

            let testPath = path.join(__dirname, 'L0overwritesReadonly.js');
            let runner: mocktest.MockTestRunner = new mocktest.MockTestRunner(testPath);
            runner.run();

            assert(
                runner.succeeded,
                'should have succeeded');
            assert(
                runner.stdOutContained(`creating path: /destDir`),
                'should have mkdirP destDir');
            assert(
                runner.stdOutContained(`creating path: ${path.join('/destDir', 'someOtherDir')}`),
                'should have mkdirP someOtherDir');
            assert(
                runner.stdOutContained(`chmodSync ${path.join('/destDir', 'someOtherDir', 'file1.file')} ${(6 << 6) + (6 << 3) + 6}`), // rw-rw-rw-
                'should have chmod file1');
            assert(
                runner.stdOutContained(`copying /srcDir/someOtherDir/file1.file to ${path.join('/destDir', 'someOtherDir', 'file1.file')}`),
                'should have copied file1');
            assert(
                !runner.stdOutContained(`chmodSync ${path.join('/destDir', 'someOtherDir', 'file2.file')} ${(6 << 6) + (6 << 3) + 6}`), // rw-rw-rw-
                'should not have chmod file2');
            assert(
                runner.stdOutContained(`copying /srcDir/someOtherDir/file2.file to ${path.join('/destDir', 'someOtherDir', 'file2.file')}`),
                'should have copied file2');
            done();
        });
    }
});
