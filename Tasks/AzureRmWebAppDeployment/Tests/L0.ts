import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
var ltx = require('ltx');
import fs = require('fs');

describe('AzureRmWebAppDeployment Suite', function() {
     before((done) => {
        tl.cp(path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web.config'), path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.config'), '-f', false);
        tl.cp(path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web.Debug.config'), path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.Debug.config'), '-f', false);
        tl.cp(path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters.xml'), path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters_test.xml'), '-f', false);
        tl.cp(path.join(__dirname, "..", "node_modules","webdeployment-common","Tests", 'L1XdtTransform', 'Web.config'), path.join(__dirname, "..", "node_modules","webdeployment-common","Tests", 'L1XdtTransform', 'Web_test.config'), '-f', false);
        done();
    });
    after(function() {
        tl.rmRF(path.join(__dirname, "..", "node_modules","webdeployment-common","Tests", 'L1XdtTransform', 'Web_test.config'), true);
        tl.rmRF(path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.config'), true);
        tl.rmRF(path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_Test.Debug.config'), true);
        tl.rmRF(path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters_test.xml'), true);
    });

    if(tl.osType().match(/^Win/)) {
        it('Runs successfully with default inputs', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0WindowsDefault.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool once');
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            var expectedOut = 'Updated history to kudu'; 
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            assert(tr.succeeded, 'task should have succeeded');
            done();
        });

        it('Runs successfully with default inputs and add web.config for node is selected', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0GenerateWebConfigForNode.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            
            assert(tr.invokedToolCount == 1, 'should have invoked tool once');
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            var expectedOut = "loc_mock_SuccessfullyGeneratedWebConfig";
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            expectedOut = 'Updated history to kudu'; 
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            assert(tr.succeeded, 'task should have succeeded');
            done();
        });

        it('Verify logs pushed to Kudu when task runs successfully with default inputs and env variables found', (done) => {
            this.timeout(1000);
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
                teamProject : '1',
                slotName : 'Production'
            });
            var expectedRequestBody = JSON.stringify({
                active : true,
                status : 4,
                status_text : 'success', 
                message : expectedMessage,
                author : 'author',
                deployer : 'VSTS',
                details : 'https://abc.visualstudio.com/1/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=1&_a=release-summary'
            });
            expectedRequestBody = 'kudu log requestBody is:' + expectedRequestBody;
            assert(tr.invokedToolCount == 1, 'should have invoked tool once');
            assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            assert(tr.stdout.indexOf(expectedRequestBody) != -1, 'should have said: ' + expectedRequestBody);
            done();
        });

        it('Runs successfully with all other inputs', (done) => {
            let tp = path.join(__dirname, 'L0WindowsAllInput.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            
            var expectedOut = 'Updated history to kudu'; 
            assert(tr.invokedToolCount == 1, 'should have invoked tool once');
            assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
            assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            assert(tr.succeeded, 'task should have succeeded');
            done();
        });

        it('Runs successfully with default inputs for deployment to specific slot', (done) => {
            let tp = path.join(__dirname, 'L0WindowsSpecificSlot.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            
            var expectedOut = 'Updated history to kudu';
            assert(tr.invokedToolCount == 1, 'should have invoked tool once');
            assert(tr.stderr.length == 0  && tr.errorIssues.length == 0, 'should not have written to stderr');
            assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            assert(tr.succeeded, 'task should have succeeded');
            done();
        });

        it('Fails if msdeploy cmd fails to execute', (done) => {
            let tp = path.join(__dirname, 'L0WindowsFailDefault.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            var expectedErr = 'Error: msdeploy failed with return code: 1';
            var expectedOut = 'Failed to update history to kudu';
            assert(tr.invokedToolCount == 1, 'should have invoked tool once');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'E should have said: ' + expectedErr); 
            assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
            var sampleOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(sampleOut) < 0, 'should not have updated web app config details');
            assert(tr.failed, 'task should have failed');
            done();
        });

        it('Verify logs pushed to kudu when task fails if msdeploy cmd fails to execute and some env variables not found', (done) => {
            this.timeout(1000);
            let tp = path.join(__dirname, 'L0WindowsFailDefault.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            
            var expectedErr = 'Error: msdeploy failed with return code: 1';
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
                teamProject : '1',
                slotName : 'Production'
            });
            var expectedRequestBody = JSON.stringify({
                active : false,
                status : 3,
                status_text : 'failed', 
                message : expectedMessage,
                author : 'author',
                deployer : 'VSTS',
                details : 'https://abc.visualstudio.com/1/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=1&_a=release-summary'
            });

            assert(tr.invokedToolCount == 1, 'should have invoked tool once');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
            
            assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
            assert(tr.failed, 'task should have failed');
            expectedRequestBody = 'kudu log requestBody is:' + expectedRequestBody;
            assert(tr.stdout.indexOf(expectedRequestBody) != -1, 'should have said: ' + expectedRequestBody);
            var sampleOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(sampleOut) < 0, 'should not have updated web app config details');
            done();
        });

        it('Runs successfully with parameter file present in package', (done) => {
            let tp = path.join(__dirname, 'L0WindowsParamFileinPkg.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            
            var expectedOut = 'Updated history to kudu';
            assert(tr.invokedToolCount == 1, 'should have invoked tool once');
            assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
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
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            done();
        });

        it('Fails if parameters file provided by user is not present', (done) => {
            let tp = path.join(__dirname, 'L0WindowsFailSetParamFile.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 0, 'should not have invoked tool');
            assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
            var expectedErr = 'Error: loc_mock_SetParamFilenotfound0 invalidparameterFile.xml'; 
            assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
            var expectedOut = 'Failed to update history to kudu';
            assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
            var sampleOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(sampleOut) < 0, 'should not have updated web app config details');
            assert(tr.failed, 'task should have failed');
            done();
        });

        it('Runs successfully with Folder Deployment', (done) => {
            let tp = path.join(__dirname, 'L0WindowsFolderPkg.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            
            assert(tr.invokedToolCount == 1, 'should have invoked tool once');
            assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            var expectedOut = 'Updated history to kudu'; 
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            done();
        });

        it('Runs successfully with XML Transformation (L1)', (done:MochaDone) => {
            let tp = path.join(__dirname, "..", "node_modules","webdeployment-common","Tests","L1XdtTransform.js");
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","webdeployment-common","Tests", 'L1XdtTransform', 'Web_test.config')));
            var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","webdeployment-common","Tests", 'L1XdtTransform','Web_Expected.config')));
            assert(ltx.equal(resultFile, expectFile) , 'Should Transform attributes on Web.config');
            done();
        });

        it('Runs Successfully with XML Transformation (Mock)', (done) => {
            this.timeout(1000);
            let tp = path.join(__dirname, 'L0WindowsXdtTransformation.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            var expectedOut = 'Updated history to kudu';
            assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
            assert(tr.stderr.length == 0  && tr.errorIssues.length == 0, 'should not have written to stderr');
            assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.search('loc_mock_AutoParameterizationMessage'), 'Should have provided message for MSBuild package');
            done();
        });

        it('Fails if XML Transformation throws error (Mock)', (done) => {
            let tp = path.join(__dirname, 'L0WindowsXdtTransformationFail.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            var expectedErr = 'Error: loc_mock_XdtTransformationErrorWhileTransforming C:\\tempFolder\\web.config C:\\tempFolder\\web.Release.config';
            assert(tr.invokedToolCount == 1, 'should have invoked tool only once');
            assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
            assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'Should have said: ' + expectedErr);
            var expectedOut = 'Failed to update history to kudu'; 
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            var sampleOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(sampleOut) < 0, 'should not have updated web app config details');
            assert(tr.failed, 'task should have failed');
            done();
        });

        it('Fails if XML Transformation throws error (Mock) for MSBuild package', (done) => {
            this.timeout(1000);
            let tp = path.join(__dirname, 'L0XdtTransformationFailMSBuildPackage.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.search('loc_mock_FailedToApplyTransformation'), 'Should have provided proper errror message for MSBuild package');
            assert(tr.stdout.search('loc_mock_AutoParameterizationMessage'), 'Should have provided message for MSBuild package');
            done();
        });
    }
    else {
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
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            done();
        });

        it('Runs KuduDeploy successfully with folder archiving on non-windows agent', (done) => {
            let tp = path.join(__dirname, 'L0NonWindowsFolderPkg.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
            assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
            var expectedOut = 'Compressed folder '; 
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            expectedOut = 'Deployed using KuduDeploy'; 
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            expectedOut = 'Updated history to kudu'; 
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            expectedOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
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
            var sampleOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(sampleOut) < 0, 'should not have updated web app config details');
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
            var expectedOut = 'Failed to update history to kudu'; 
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            var sampleOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(sampleOut) < 0, 'should not have updated web app config details');
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
            var expectedOut = 'Failed to update history to kudu'; 
            assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
            var sampleOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
            assert(tr.stdout.search(sampleOut) < 0, 'should not have updated web app config details');
            assert(tr.failed, 'task should have failed');
            done();
        });
    }
    
    it('Fails if more than one package matched with specified pattern', (done) => {
        let tp = path.join(__dirname, 'L0WindowsManyPackage.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        var expectedErr = 'Error: loc_mock_MorethanonepackagematchedwithspecifiedpatternPleaserestrainthesearchpattern'; 
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr); 
        var expectedOut = 'Failed to update history to kudu';
        assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
        var sampleOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
        assert(tr.stdout.search(sampleOut) < 0, 'should not have updated web app config details');
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
        var expectedOut = 'Failed to update history to kudu';
        assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut); 
        var sampleOut = 'loc_mock_SuccessfullyUpdatedAzureRMWebAppConfigDetails';
        assert(tr.stdout.search(sampleOut) < 0, 'should not have updated web app config details');
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Runs successfully with XML variable substitution', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname,  "..", "node_modules","webdeployment-common","Tests", 'L1XmlVarSub', 'Web_test.config')));
        var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","webdeployment-common","Tests", 'L1XmlVarSub', 'Web_Expected.config')));
        assert(ltx.equal(resultFile, expectFile) , 'Should have substituted variables in Web.config file');
        var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.Debug.config')));
        var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_Expected.Debug.config')));
        assert(ltx.equal(resultFile, expectFile) , 'Should have substituted variables in Web.Debug.config file');   
        var resultParamFile = ltx.parse(fs.readFileSync(path.join(__dirname,  "..", "node_modules","webdeployment-common","Tests", 'L1XmlVarSub', 'parameters_test.xml')));
        var expectParamFile = ltx.parse(fs.readFileSync(path.join(__dirname,  "..", "node_modules","webdeployment-common","Tests", 'L1XmlVarSub', 'parameters_Expected.xml')));
        assert(ltx.equal(resultParamFile, expectParamFile) , 'Should have substituted variables in parameters.xml file');

        done();
    });

    it('Runs successfully with JSON variable substitution', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1JsonVarSub.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('JSON - eliminating object variables validated') > 0, 'JSON - eliminating object variables validation error');
        assert(tr.stdout.search('JSON - simple string change validated') > 0,'JSON -simple string change validation error' );
        assert(tr.stdout.search('JSON - system variable elimination validated') > 0, 'JSON -system variable elimination validation error');
        assert(tr.stdout.search('JSON - special variables validated') > 0, 'JSON - special variables validation error');
        assert(tr.stdout.search('JSON - variables with dot character validated') > 0, 'JSON variables with dot character validation error');
        assert(tr.stdout.search('JSON - substitute inbuilt JSON attributes validated') > 0, 'JSON inbuilt variable substitution validation error');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Validate File Encoding', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L1ValidateFileEncoding.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('UTF-8 with BOM validated') >= 0, 'Should have validated UTF-8 with BOM');
        assert(tr.stdout.search('UTF-16LE with BOM validated') >= 0, 'Should have validated UTF-16LE with BOM');
        assert(tr.stdout.search('UTF-16BE with BOM validated') >= 0, 'Should have validated UTF-16BE with BOM');
        assert(tr.stdout.search('UTF-32LE with BOM validated') >= 0, 'Should have validated UTF-32LE with BOM');
        assert(tr.stdout.search('UTF-32BE with BOM validated') >= 0, 'Should have validated UTF-32BE with BOM');

        assert(tr.stdout.search('UTF-8 without BOM validated') >= 0, 'Should have validated UTF-8 without BOM');
        assert(tr.stdout.search('UTF-16LE without BOM validated') >= 0, 'Should have validated UTF-16LE without BOM');
        assert(tr.stdout.search('UTF-16BE without BOM validated') >= 0, 'Should have validated UTF-16BE without BOM');
        assert(tr.stdout.search('UTF-32LE without BOM validated') >= 0, 'Should have validated UTF-32LE without BOM');
        assert(tr.stdout.search('UTF-32BE without BOM validated') >= 0, 'Should have validated UTF-32BE without BOM');

        assert(tr.stdout.search('Short File Buffer Error') >= 0, 'Should have validated short Buffer');
        assert(tr.stdout.search('Unknown encoding type') >= 0, 'Should throw for Unknown File Buffer');
        done();
    });

     it('Validate webdeployment-common.utility.copyDirectory()', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L0CopyDirectory.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('## Copy Files Successful ##') >=0, 'should have copied the files');
        assert(tr.stdout.search('## mkdir Successful ##') >= 0, 'should have created dir including dest folder');
        done();
    });

    it('Validate webdepoyment-common.utility.runPostDeploymentScript()', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0RunPostDeploymentScript.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.search('PUT:https://mytestappKuduUrl/api/vfs/site/wwwroot/kuduPostDeploymentScript.cmd') >= 0, 'should have uploaded file: kuduPostDeploymentScript.cmd');
        assert(tr.stdout.search('PUT:https://mytestappKuduUrl/api/vfs/site/wwwroot/mainCmdFile.cmd') >= 0, 'should have uploaded file: mainCmdFile.cmd');
        assert(tr.stdout.search('POST:https://mytestappKuduUrl/api/command') >= 0, 'should have executed script');
        assert(tr.stdout.search('GET:https://mytestappKuduUrl/api/vfs/site/wwwroot/stdout.txt') >= 0, 'should have retrieved file content: stdout.txt');
        assert(tr.stdout.search('GET:https://mytestappKuduUrl/api/vfs/site/wwwroot/stderr.txt') >= 0, 'should have retrieved file content: stderr.txt');
        assert(tr.stdout.search('GET:https://mytestappKuduUrl/api/vfs/site/wwwroot/script_result.txt') >= 0, 'should have retrieved file content: script_result.txt');
        done();
    });

    it('Validate webdeployment-common.generatewebconfig.generateWebConfigFile()', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "webdeployment-common", "Tests", 'L0GenerateWebConfig.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('web.config contents: server.js;iisnode') >=0, 'should have replaced web config parameters');
        done();
    }); 

    it('Validate success azurerestutility-common.testAzureWebAppAvailability()', (done:MochaDone) => {
        let tp = path.join(__dirname, 'WebAppAvailabilitySuccessTest.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.stdout.search('Azure web app is available.') >=0, 'Failed while checking azure web app avilability.');
        done();
    });

    it('validate failure azurerestutility-common.testAzureWebAppAvailability()', (done:MochaDone) => {
        let tp = path.join(__dirname, 'WebAppAvailabilityFailureTest.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.stdout.search('Azure web app in wrong state, status code : 500') >=0, 'Failed while checking azure web app avilability.');
        done();
    });

});
