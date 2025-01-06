import * as tl from 'azure-pipelines-task-lib';
import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
var ltx = require('ltx');
import fs = require('fs');
var fileEncoding = require("../node_modules/azure-pipelines-tasks-webdeployment-common/fileencoding.js");

describe('IISWebsiteDeploymentOnMachineGroup test suite', function () {
    var taskSrcPath = path.join(__dirname, '..', 'deployiiswebapp.js');
    this.timeout(60000);
    before((done) => {
        done();
    });
    after(function () {
    });

    if (!tl.osType().match(/^Win/)) {
        return;
    }
    it('Runs successfully with default inputs', async () => {
        let tp = path.join(__dirname, 'L0WindowsDefault.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Runs successfully with all other inputs', async () => {
        let tp = path.join(__dirname, 'L0WindowsAllInput.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Fails if msdeploy fails to execute', async () => {
        let tp = path.join(__dirname, 'L0WindowsFailDefault.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        var expectedErr = 'Error: msdeploy failed with return code: 1';
        assert(tr.invokedToolCount == 3, 'should have invoked tool thrice despite failure');
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'E should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');
    });

    it('Runs successfully with parameter file present in package', async () => {
        let tp = path.join(__dirname, 'L0WindowsParamFileinPkg.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Fails if parameters file provided by user is not present', async () => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0WindowsFailSetParamFile.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        var expectedErr = 'Error: loc_mock_SetParamFilenotfound0 invalidparameterFile.xml';
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have succeeded');
    });

    it('Fails if more than one package matched with specified pattern', async () => {
        let tp = path.join(__dirname, 'L0WindowsManyPackage.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        var expectedErr = 'Error: loc_mock_MorethanonepackagematchedwithspecifiedpatternPleaserestrainthesearchpattern';
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');
    });

    it('Fails if package or folder name is invalid', async () => {
        let tp = path.join(__dirname, 'L0WindowsNoPackage.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        var expectedErr = 'Error: loc_mock_Nopackagefoundwithspecifiedpattern';
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');
    });

    it('Runs Successfully with XDT Transformation (Mock)', async () => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0WindowsXdtTransformation.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
        let expectedErr = "loc_mock_XDTTransformationsappliedsuccessfully";
        assert(tr.stdout.search(expectedErr) >= 0);
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Fails if XDT Transformation throws error (Mock)', async () => {
        let tp = path.join(__dirname, 'L0WindowsXdtTransformationFail.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        var expectedErr = 'Error: loc_mock_XdtTransformationErrorWhileTransforming C:\\tempFolder\\web.config C:\\tempFolder\\web.Release.config';
        assert(tr.invokedToolCount == 1, 'should have invoked tool only once');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'E should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');
    });
});
