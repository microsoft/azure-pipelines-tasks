import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import {NpmMockHelper} from './NpmMockHelper';

describe('Npm Task', function () {
    before(() => {
    });

    after(() => {
    });

    /* Current behavior */
    it("should execute 'npm config list' successfully", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'test-configlist.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'should have run vsts-npm-auth, npm config list and npm command');
        assert(tr.ran(`${NpmMockHelper.NpmCmdPath} config list`), 'it should have run npm');
        assert(tr.stdOutContained('; cli configs'), "should have npm config output");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        // This assert is skipped due to a test mocking issue on non windows platforms.
        // assert.equal(tr.warningIssues.length, 0, "should have no warnings: " + tr.warningIssues.join(','));
        assert(tr.succeeded, 'should have succeeded');

        done();
    });
    
    it('should pass when no arguments are supplied', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'test-commandWithoutArguments.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'should have run npm');
        assert(tr.ran(`${NpmMockHelper.NpmCmdPath} root`), 'it should have run npm');
        assert(tr.stdOutContained(`${NpmMockHelper.FakeWorkingDirectory}`), "should have npm root output - working directory");
        assert(tr.stdOutContained("node_modules"), "should have npm root output - 'node_modules' directory");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        // This assert is skipped due to a test mocking issue on non windows platforms.
        // assert.equal(tr.warningIssues.length, 0, "should have no warnings: " + tr.warningIssues.join(','));
        assert(tr.succeeded, 'should have succeeded');

        done();
    });
    
    it('should fail when command contains spaces', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'test-commandContainsSpaces.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 0, 'should not have run npm');
        assert(tr.failed, 'should have failed');

        done();
    });
      
    it('should fail when task fails', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'test-npmFailure.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'should have run npm');
        assert(tr.failed, 'should have failed');

        done();
    });

    /* Deprecated behavior */
    it("should execute 'npm config list' successfully (deprecated task)", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'test-configlist-deprecated.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 1, 'should have run npm');
        assert(tr.ran(`${NpmMockHelper.NpmCmdPath} config list`), 'it should have run npm');
        assert(tr.stdOutContained('; cli configs'), "should have npm config output");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        assert.equal(tr.warningIssues.length, 0, "should have no warnings: " + tr.warningIssues.join(','));
        assert(tr.succeeded, 'should have succeeded');

        done();
    });
    
    it('should pass when no arguments are supplied (deprecated task)', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'test-commandWithoutArguments-deprecated.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 1, 'should have run npm');
        assert(tr.ran(`${NpmMockHelper.NpmCmdPath} root`), 'it should have run npm');
        assert(tr.stdOutContained(`${NpmMockHelper.FakeWorkingDirectory}`), "should have npm root output - working directory");
        assert(tr.stdOutContained("node_modules"), "should have npm root output - 'node_modules' directory");
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        assert.equal(tr.warningIssues.length, 0, "should have no warnings: " + tr.warningIssues.join(','));
        assert(tr.succeeded, 'should have succeeded');

        done();
    });
    
    it('should fail when command contains spaces (deprecated task)', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'test-commandContainsSpaces-deprecated.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 0, 'should not have run npm');
        assert(tr.failed, 'should have failed');

        done();
    });
      
    it('should fail when task fails (deprecated task)', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'test-npmFailure-deprecated.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 1, 'should have run npm');
        assert(tr.failed, 'should have failed');

        done();
    });
});