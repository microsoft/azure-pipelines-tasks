import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';

describe('AzureRmWebAppDeployment Suite', function() {
     var taskSrcPath = path.join(__dirname, '..');
     var testSrcPath = path.join(__dirname);

     before((done) => {
        done();
    });
    after(function() {

    });

    it('Runs successfully with default inputs', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0WindowsDefault.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run()

        assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        var expectedOut = 'Updated history to kudu'; 
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Verify logs pushed to Kudu when task runs successfully with default inputs and env variables found', (done) => {
        
        let tp = path.join(__dirname, 'L0WindowsDefault.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var expectedOut = 'Updated history to kudu'; 
        var expectedMessage = JSON.stringify({
            type : 'Deployment',
            commitId : '46da24f35850f455185b9188b4742359b537076f',
            buildId : '1',
            releaseId : '1',
            buildNumber : '1',
            releaseName : 'Release-1',
            repoProvider : 'TfsGit',
            repoName : 'MyFirstProject',
            collectionUrl : 'https://abc.visualstudio.com/',
            teamProject : 'MyFirstProject',
            slotName : 'Production'
        });
        var expectedRequestBody = JSON.stringify({
            status : 4,
            status_text : 'success', 
            message : expectedMessage,
            author : 'author',
            deployer : 'VSTS',
            details : 'https://abc.visualstudio.com/MyFirstProject/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=1&_a=release-summary'
        });
        expectedRequestBody = 'kudu log requestBody is:' + expectedRequestBody;

        assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        assert(tr.stdout.indexOf(expectedRequestBody) >= 0, 'should have said: ' + expectedRequestBody);
        done();
    });

     it('Runs successfully with all other inputs', (done) => {
        let tp = path.join(__dirname, 'L0WindowsAllInput.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var expectedOut = 'Updated history to kudu'; 
        assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Runs successfully with default inputs for deployment to specific slot', (done) => {
        let tp = path.join(__dirname, 'L0WindowsSpecificSlot.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var expectedOut = 'Updated history to kudu';
        assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
        assert(tr.stderr.length == 0  && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Runs Successfully with XDT Transformation', (done) => {
        let tp = path.join(__dirname, 'L0WindowsXdtTransformation.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run()

        var expectedOut = 'Updated history to kudu';
        assert(tr.invokedToolCount == 3, 'should have invoked tool thrice');
        assert(tr.stderr.length == 0  && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Fails if XDT Transformation throws error', (done) => {
        let tp = path.join(__dirname, 'L0WindowsXdtTransformationFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        
        var expectedErr = "Error: loc_mock_XdtTransformationErrorWhileTransforming";
        assert(tr.invokedToolCount == 1, 'should have invoked tool only once');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'E should have said: ' + expectedErr); 
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Fails if XDT Transformation is run on non-windows platform', (done) => {
        let tp = path.join(__dirname, 'L0NonWindowsXdtTransformationFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var expectedErr = "Error: loc_mock_CannotPerformXdtTransformationOnNonWindowsPlatform";
        assert(tr.invokedToolCount == 0, 'should not have invoked tool any tool');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'E should have said: ' + expectedErr); 
        assert(tr.failed, 'task should have failed');
        done();
    });
    it('Fails if msdeploy cmd fails to execute', (done) => {
        let tp = path.join(__dirname, 'L0WindowsFailDefault.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        var expectedErr = 'Error: Error: cmd failed with return code: 1';
        var expectedOut = 'Failed to update history to kudu';
        assert(tr.invokedToolCount == 2, 'should have invoked tool once');
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'E should have said: ' + expectedErr); 
        assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Verify logs pushed to kudu when task fails if msdeploy cmd fails to execute and some env variables not found', (done) => {
        let tp = path.join(__dirname, 'L0WindowsFailDefault.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var expectedErr = 'Error: Error: cmd failed with return code: 1';
        var expectedOut = 'Failed to update history to kudu';
        var expectedMessage = JSON.stringify({
            type: "Deployment",
            commitId : '46da24f35850f455185b9188b4742359b537076f',
            buildId : '1',
            releaseId : '1',
            buildNumber : '1',
            releaseName : 'Release-1',
            repoProvider : 'TfsGit',
            repoName : 'MyFirstProject',
            collectionUrl : 'https://abc.visualstudio.com/',
            teamProject : 'MyFirstProject',
            slotName : 'Production'
        });
        var expectedRequestBody = JSON.stringify({
            status : 3,
            status_text : 'failed', 
            message : expectedMessage,
            author : 'author',
            deployer : 'VSTS',
            details : 'https://abc.visualstudio.com/MyFirstProject/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=1&_a=release-summary'
        });

        assert(tr.invokedToolCount == 2, 'should have invoked tool once');
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
        assert(tr.failed, 'task should have failed');

        expectedRequestBody = 'kudu log requestBody is:' + expectedRequestBody;
        assert(tr.stdout.indexOf(expectedRequestBody) >= 0, 'should have said: ' + expectedRequestBody);
        done();
    });

    it('Runs successfully with parameter file present in package', (done) => {
        let tp = path.join(__dirname, 'L0WindowsParamFileinPkg.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        var expectedOut = 'Updated history to kudu';
        assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr'); 
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        assert(tr.succeeded, 'task should have succeeded');
        done();

    });

    it('Runs successfully with parameter file present in package on non-windows', (done) => {
        let tp = path.join(__dirname, 'L0NonWindowsParamFileinPkg.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var expectedOut = 'Deployed using KuduDeploy';
        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded'); 
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        expectedOut = 'Updated history to kudu'; 
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        done();
    });

    it('Fails if parameters file provided by user is not present', (done) => {
        let tp = path.join(__dirname, 'L0WindowsFailSetParamFile.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        var expectedErr = 'Error: loc_mock_SetParamFilenotfound0'; 
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have succeeded');
        done();
    });

    it('Fails if more than one package matched with specified pattern', (done) => {
        let tp = path.join(__dirname, 'L0WindowsManyPackage.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        var expectedErr = 'Error: loc_mock_MorethanonepackagematchedwithspecifiedpatternPleaserestrainthesearchpatern'; 
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr); 
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Fails if package or folder name is invalid', (done) => {
        let tp = path.join(__dirname, 'L0WindowsNoPackage.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        var expectedErr = 'Error: loc_mock_Nopackagefoundwithspecifiedpattern'; 
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr); 
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Runs successfully with Folder Deployment', (done) => {
        let tp = path.join(__dirname, 'L0WindowsFolderPkg.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have failed');
        done();
    });

    it('Runs KuduDeploy successfully with default inputs on non-windows agent', (done) => {
        let tp = path.join(__dirname, 'L0NonWindowsDefault.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var expectedOut = 'Deployed using KuduDeploy'; 
        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        expectedOut = 'Updated history to kudu'; 
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        done();
    });

    it('Runs KuduDeploy successfully with folder archiving on non-windows agent', (done) => {
        let tp = path.join(__dirname, 'L0NonWindowsFolderPkg.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
        var expectedOut = 'loc_mock_Compressedfolderintozip'; 
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        expectedOut = 'Deployed using KuduDeploy'; 
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        expectedOut = 'Updated history to kudu'; 
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Fails KuduDeploy if parameter file is present in package', (done) => {
        let tp = path.join(__dirname, 'L0NonWindowsFailParamPkg.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        var expectedErr = 'Error: Error: loc_mock_MSDeploygeneratedpackageareonlysupportedforWindowsplatform'
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);                
        var expectedOut = 'Failed to update history to kudu'; 
        assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Fails KuduDeploy if folder archiving fails', (done) => {
        let tp = path.join(__dirname, 'L0NonWindowsFailArchive.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length >  0 || tr.errorIssues.length > 0, 'should have written to stderr');
        var expectedErr = 'Error: Error: Folder Archiving Failed'; 
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr); 
        assert(tr.failed, 'task should have failed');
        done();
    });

});
