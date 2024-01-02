import * as assert from 'assert';
import * as path from 'path';
import * as os from 'os';
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

describe('PublishBuildArtifactsV1 Suite', function () {
    this.timeout(10000);

    it('Publish to container', (done: Mocha.Done) => {
        const testPath: string = path.join(__dirname, 'L0PublishToContainer.js');
        const testRunner = new MockTestRunner(testPath);
        testRunner.run();

        assert(testRunner.stderr.length === 0, 'should not have written to stderr. error: ' + testRunner.stderr);
        assert(testRunner.succeeded, 'task should have succeeded');
        assert(testRunner.stdout.search(/##vso\[artifact.upload artifactType=container;artifactName=drop;containerfolder=drop;localpath=\/bin\/release;\]\/bin\/release/gi) >= 0, 'should publish artifact.');

        done();
    });

    if (os.platform() === 'win32') {
        it('Publish to UNC', (done: Mocha.Done) => {
            const testPath: string = path.join(__dirname, 'L0PublishToUnc.js');
            const testRunner = new MockTestRunner(testPath);
            testRunner.run();

            assert(!testRunner.stderr, 'should not have written to stderr. error: ' + testRunner.stderr);
            assert(testRunner.succeeded, 'task should have succeeded');
            assert(testRunner.stdout.indexOf('test stdout from robocopy (no trailing slashes)') >= 0, 'should copy files.');
            assert(testRunner.stdout.search(/artifact.associate/gi) >= 0, 'should associate artifact.');
            done();
        });

        it('Appends . to robocopy source with trailing slash', (done: Mocha.Done) => {
            const testPath: string = path.join(__dirname, 'L0AppendDotToRobocopySource.js');
            const testRunner = new MockTestRunner(testPath);
            testRunner.run();

            assert(!testRunner.stderr, 'should not have written to stderr. error: ' + testRunner.stderr);
            assert(testRunner.succeeded, 'task should have succeeded');
            assert(testRunner.stdout.indexOf('test stdout from robocopy (source with trailing slash)') >= 0, 'should copy files.');
            assert(testRunner.stdout.search(/artifact.associate/gi) >= 0, 'should associate artifact.');
            done();
        });

        it('Appends . to robocopy target with trailing slash', (done: Mocha.Done) => {
            const testPath: string = path.join(__dirname, 'L0AppendDotToRobocopyTarget.js');
            const testRunner = new MockTestRunner(testPath);
            testRunner.run();

            assert(!testRunner.stderr, 'should not have written to stderr. error: ' + testRunner.stderr);
            assert(testRunner.succeeded, 'task should have succeeded');
            assert(testRunner.stdout.indexOf('test stdout from robocopy (target with trailing slash)') >= 0, 'should copy files.');
            assert(testRunner.stdout.search(/artifact.associate/gi) >= 0, 'should associate artifact.');
            done();
        });

        it('Copy single file with robocopy', (done: Mocha.Done) => {
            const testPath: string = path.join(__dirname, 'L0CopySingleFileWithRobocopy.js');
            const testRunner = new MockTestRunner(testPath);
            testRunner.run();

            assert(!testRunner.stderr, 'should not have written to stderr. error: ' + testRunner.stderr);
            assert(testRunner.succeeded, 'task should have succeeded');
            assert(testRunner.stdout.indexOf('test stdout from robocopy (copy a single file)') >= 0, 'should copy files.');
            assert(testRunner.stdout.search(/artifact.associate/gi) >= 0, 'should associate artifact.');
            done();
        });

        it('fails if robocopy fails', (done: Mocha.Done) => {
            const testPath: string = path.join(__dirname, 'L0FailsIfRobocopyFails.js');
            const testRunner = new MockTestRunner(testPath);
            testRunner.run();

            assert(testRunner.failed, 'task should have failed');
            assert(testRunner.stdout.match(/test stdout from robocopy/gi).length === 1, 'should call robocopy.');
            assert(testRunner.stdout.search(/artifact.associate/gi) >= 0, 'should associate artifact.');
            done();
        });

        it('creates filepath artifact', (done: Mocha.Done) => {
            const testPath: string = path.join(__dirname, 'L0CreatesFilepathArtifact.js');
            const testRunner = new MockTestRunner(testPath);
            testRunner.run();

            assert(!testRunner.stderr, 'should not have written to stderr. error: ' + testRunner.stderr);
            assert(testRunner.succeeded, 'task should have succeeded');
            assert(testRunner.stdout.indexOf('##vso[artifact.associate artifacttype=filepath;artifactname=drop;artifactlocation=\\\\UNCShare\\subdir;]\\\\UNCShare\\subdir') >= 0, 'should associate artifact.');
            done();
        });
    } else {
        it('fails to create filepath artifact', (done: Mocha.Done) => {
            const testPath: string = path.join(__dirname, 'L0FailsToCreateFilepathArtifact.js');
            const testRunner = new MockTestRunner(testPath);
            testRunner.run();

            assert(testRunner.stdout.match(/loc_mock_ErrorFileShareLinux/), 'should have written error message');
            assert(testRunner.failed, 'task should have succeeded');
            assert(testRunner.stdout.indexOf('##vso[artifact.associate') < 0, 'should not associate artifact.');
            done();
        });
    }

    it('fails if PathtoPublish not set', (done: Mocha.Done) => {
        const testPath: string = path.join(__dirname, 'L0FailsIfPathToPublishNotSet.js');
        const testRunner = new MockTestRunner(testPath);
        testRunner.run();

        assert(testRunner.stdOutContained('Input required: PathtoPublish'));
        assert(testRunner.failed, 'task should have failed');
        assert(testRunner.invokedToolCount === 0, 'should exit before running PublishBuildArtifacts');
        done();
    });

    it('fails if ArtifactName not set', (done: Mocha.Done) => {
        const testPath: string = path.join(__dirname, 'L0FailsIfArtifactNameNotSet.js');
        const testRunner = new MockTestRunner(testPath);
        testRunner.run();

        assert(testRunner.stdOutContained('Input required: ArtifactName'));
        assert(testRunner.failed, 'task should have failed');
        assert(testRunner.invokedToolCount === 0, 'should exit before running PublishBuildArtifacts');
        done();
    });

    it('fails if ArtifactType not set', (done: Mocha.Done) => {
        const testPath: string = path.join(__dirname, 'L0FailsIfArtifactTypeNotSet.js');
        const testRunner = new MockTestRunner(testPath);
        testRunner.run();

        assert(testRunner.stdOutContained('Input required: ArtifactType'));
        assert(testRunner.failed, 'task should have failed');
        assert(testRunner.invokedToolCount === 0, 'should exit before running PublishBuildArtifacts');
        done();
    });

    it('fails if PathtoPublish not found', (done: Mocha.Done) => {
        const testPath: string = path.join(__dirname, 'L0FailsIfPathToPublishNotFound.js');
        const testRunner = new MockTestRunner(testPath);
        testRunner.run();

        assert(testRunner.failed, 'should have failed');
        const expectedErr = 'Not found /bin/notexist';
        assert(testRunner.stdOutContained(expectedErr), 'should have said: ' + expectedErr);
        assert(testRunner.invokedToolCount === 0, 'should exit before running PublishBuildArtifacts');
        done();
    });

    it('Add a single file to tar before uploading', (done: Mocha.Done) => {
        const testPath: string = path.join(__dirname, 'L0StoreFileAsTar.js');
        const testRunner = new MockTestRunner(testPath);
        testRunner.run();

        assert(testRunner.stderr.length === 0, 'should not have written to stderr. error: ' + testRunner.stderr);
        assert(testRunner.succeeded, 'task should have succeeded');
        assert(testRunner.stdOutContained('test stdout from tar: added file to archive'), 'should have run tar');
        const artifactPath: string = path.join(process.cwd(), 'drop.tar');
        assert(testRunner.stdOutContained(`##vso[artifact.upload artifacttype=container;artifactname=drop;containerfolder=drop;localpath=${artifactPath};]${artifactPath}`));
        done();
    });

    it('Add a folder to tar before uploading', (done: Mocha.Done) => {
        const testPath: string = path.join(__dirname, 'L0StoreFolderAsTar.js');
        const testRunner = new MockTestRunner(testPath);
        testRunner.run();

        assert(testRunner.stderr.length === 0, 'should not have written to stderr. error: ' + testRunner.stderr);
        assert(testRunner.succeeded, 'task should have succeeded');
        assert(testRunner.stdOutContained('test stdout from tar: added folder to archive'), 'should have run tar');
        const artifactPath: string = path.join(process.cwd(), 'drop.tar');
        assert(testRunner.stdOutContained(`##vso[artifact.upload artifacttype=container;artifactname=drop;containerfolder=drop;localpath=${artifactPath};]${artifactPath}`));
        done();
    });
});
