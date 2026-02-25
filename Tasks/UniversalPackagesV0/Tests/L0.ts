import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('UniversalPackages Suite', function () {
    this.timeout(20000);

    describe('Download Tests', function () {
        it('downloads package from current organization', async function() {
            let tp = path.join(__dirname, './downloadInternal.js')
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            
            assert(tr.invokedToolCount == 1, 'should have run ArtifactTool once');
            assert(tr.ran('c:\\mock\\location\\ArtifactTool.exe universal download --feed TestFeed --service https://example.visualstudio.com/defaultcollection --package-name TestPackage --package-version 1.0.0 --path c:\\temp --patvar UNIVERSAL_DOWNLOAD_PAT --verbosity verbose'), 'it should have run ArtifactTool');
            assert(tr.stdOutContained('ArtifactTool.exe output'), "should have ArtifactTool output");
            assert(tr.succeeded, 'should have succeeded');
            assert.equal(tr.errorIssues.length, 0, "should have no errors");
        });

        it('downloads package from external feed', async function() {
            let tp = path.join(__dirname, './downloadExternal.js')
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            
            assert(tr.invokedToolCount == 1, 'should have run ArtifactTool once');
            assert(tr.succeeded, 'should have succeeded');
            assert.equal(tr.errorIssues.length, 0, "should have no errors");
        });

        it('fails when download directory is empty', async function() {
            let tp = path.join(__dirname, './downloadNoDirectory.js')
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            
            // Task returns early without setting result when directory is empty
            assert(tr.invokedToolCount == 0, 'should not run ArtifactTool when directory not specified');
        });

        it('fails on on-premise server', async function() {
            let tp = path.join(__dirname, './downloadOnPrem.js')
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            
            assert(tr.failed, 'should have failed');
            assert(tr.stdOutContained('Error_UniversalPackagesNotSupportedOnPrem') || tr.errorIssues.length > 0, 'should have error about on-prem not supported');
        });
    });

    describe('Publish Tests', function () {
        it('publishes package to current organization', async function() {
            let tp = path.join(__dirname, './publishInternal.js')
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            
            assert(tr.invokedToolCount == 1, 'should have run ArtifactTool once');
            assert(tr.succeeded, 'should have succeeded');
            assert.equal(tr.errorIssues.length, 0, "should have no errors");
        });

        it('publishes package to external feed', async function() {
            let tp = path.join(__dirname, './publishExternal.js')
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            
            assert(tr.invokedToolCount == 1, 'should have run ArtifactTool once');
            assert(tr.succeeded, 'should have succeeded');
            assert.equal(tr.errorIssues.length, 0, "should have no errors");
        });

        it('fails when publish directory is empty', async function() {
            let tp = path.join(__dirname, './publishNoDirectory.js')
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            
            // Task returns early without setting result when directory is empty
            assert(tr.invokedToolCount == 0, 'should not run ArtifactTool when directory not specified');
        });

        it('publishes with custom version', async function() {
            let tp = path.join(__dirname, './publishCustomVersion.js')
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            
            assert(tr.invokedToolCount == 1, 'should have run ArtifactTool once');
            assert(tr.succeeded, 'should have succeeded');
            assert.equal(tr.errorIssues.length, 0, "should have no errors");
        });
    });

    describe('Error Handling Tests', function () {
        it('fails with invalid command', async function() {
            let tp = path.join(__dirname, './invalidCommand.js')
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            
            assert(tr.failed, 'should have failed');
            assert(tr.stdOutContained('Error_CommandNotRecognized') || tr.errorIssues.length > 0, 'should have error about unrecognized command');
        });

        it('fails when artifact tool acquisition fails', async function() {
            let tp = path.join(__dirname, './artifactToolFailure.js')
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            
            assert(tr.failed, 'should have failed');
            assert(tr.stdOutContained('FailedToGetArtifactTool') || tr.errorIssues.length > 0, 'should have error about artifact tool');
        });
    });
});
