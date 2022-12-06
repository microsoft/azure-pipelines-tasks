import * as tl from 'azure-pipelines-task-lib';
import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
var ltx = require('ltx');
import fs = require('fs');

describe('IISWebsiteDeploymentOnMachineGroup test suite', function() {
     var taskSrcPath = path.join(__dirname, '..','deployiiswebapp.js');
     this.timeout(60000);
     before((done) => {
        tl.cp(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web.config'), path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.config'), null, false);
        tl.cp(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web.Debug.config'), path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.Debug.config'), null, false);
        tl.cp(path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XdtTransform', 'Web.config'), path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XdtTransform', 'Web_test.config'), null, false);
        tl.cp(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters.xml'), path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters_test.xml'), null, false);
        done();
    });
    after(function() {
        tl.rmRF(path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XdtTransform', 'Web_test.config'));
        tl.rmRF(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.config'));
        tl.rmRF(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_Test.Debug.config'));
        tl.rmRF(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters_test.xml'));
    });

    if(!tl.osType().match(/^Win/)) {
        return;
    }
    it('Runs successfully with default inputs', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0WindowsDefault.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

		assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

	it('Runs successfully with all other inputs', (done) => {
        let tp = path.join(__dirname, 'L0WindowsAllInput.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

		assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });
    
	it('Fails if msdeploy fails to execute', (done) => {
        let tp = path.join(__dirname, 'L0WindowsFailDefault.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        tr.run();
        
        var expectedErr = 'Error: msdeploy failed with return code: 1';
		assert(tr.invokedToolCount == 3, 'should have invoked tool thrice despite failure');
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'E should have said: ' + expectedErr); 
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Runs successfully with parameter file present in package', (done) => {
        let tp = path.join(__dirname, 'L0WindowsParamFileinPkg.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
		tr.run();

		assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.stderr.length == 0 && tr.errorIssues.length == 0, 'should not have written to stderr'); 
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Fails if parameters file provided by user is not present', (done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0WindowsFailSetParamFile.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
		tr.run();

		assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        var expectedErr = 'Error: loc_mock_SetParamFilenotfound0 invalidparameterFile.xml'; 
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
        var expectedErr = 'Error: loc_mock_MorethanonepackagematchedwithspecifiedpatternPleaserestrainthesearchpattern'; 
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

    it('Runs Successfully with XDT Transformation (Mock)', (done) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0WindowsXdtTransformation.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
        let expectedErr = "loc_mock_XDTTransformationsappliedsuccessfully";
        assert(tr.stdout.search(expectedErr) >= 0);
        assert(tr.stderr.length == 0  && tr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Fails if XDT Transformation throws error (Mock)', (done) => {
        let tp = path.join(__dirname, 'L0WindowsXdtTransformationFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var expectedErr = 'Error: loc_mock_XdtTransformationErrorWhileTransforming C:\\tempFolder\\web.config C:\\tempFolder\\web.Release.config';
        assert(tr.invokedToolCount == 1, 'should have invoked tool only once');
        assert(tr.stderr.length > 0 || tr.errorIssues.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'E should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');
        done();
        });

    it('Runs successfully with XDT Transformation (L1)', (done:MochaDone) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests","L1XdtTransform.js");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        if(tl.osType().match(/^Win/)) {
            var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XdtTransform', 'Web_test.config')));
            var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XdtTransform','Web_Expected.config')));
            assert(ltx.equal(resultFile, expectFile) , 'Should Transform attributes on Web.config');
        }
        else {
            tl.warning('Cannot test XDT Transformation in Non Windows Agent');
        }
        done();
    });


    it('Runs successfully with XML variable substitution', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
		
        var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname,  "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XmlVarSub', 'Web_test.config')));
        var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XmlVarSub', 'Web_Expected.config')));
        assert(ltx.equal(resultFile, expectFile) , 'Should have substituted variables in Web.config file');
        var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.Debug.config')));
        var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_Expected.Debug.config')));
        assert(ltx.equal(resultFile, expectFile) , 'Should have substituted variables in Web.Debug.config file');
        done();
    });

    it('Runs successfully with JSON variable substitution', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1JsonVarSub.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('JSON - eliminating object variables validated') > 0, 'JSON - eliminating object variables validation error');
        assert(tr.stdout.search('JSON - simple string change validated') > 0,'JSON -simple string change validation error' );
        assert(tr.stdout.search('JSON - system variable elimination validated') > 0, 'JSON -system variable elimination validation error');
        assert(tr.stdout.search('JSON - special variables validated') > 0, 'JSON - special variables validation error');
        assert(tr.stdout.search('JSON - variables with dot character validated') > 0, 'JSON varaibles with dot character validated');
        assert(tr.stdout.search('JSON - substitute inbuilt JSON attributes validated') > 0, 'JSON inbuilt variable substitution validation error');
        assert(tr.stdout.search('VALID JSON COMMENTS TESTS PASSED') > 0, 'VALID JSON COMMENTS TESTS PASSED');
        assert(tr.stdout.search('INVALID JSON COMMENTS TESTS PASSED') > 0, 'INVALID JSON COMMENTS TESTS PASSED');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Validate File Encoding', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1ValidateFileEncoding.js');
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

     it('Validate azure-pipelines-tasks-webdeployment-common.utility.copyDirectory()', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L0CopyDirectory.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('## Copy Files Successful ##') >=0, 'should have copied the files');
        assert(tr.stdout.search('## mkdir Successful ##') >= 0, 'should have created dir including dest folder');
        done();
    });

    it('Validate MSDeploy parameters', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests","L0MSDeployUtility.js");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('MSBUILD DEFAULT PARAMS PASSED') > 0, 'should have printed MSBUILD DEFAULT PARAMS PASSED');
        assert(tr.stdout.search('ARGUMENTS WITH SET PARAMS PASSED') > 0, 'should have printed ARGUMENTS WITH SET PARAMS PASSED');
        assert(tr.stdout.search('ARGUMENT WITH FOLDER PACKAGE PASSED') > 0, 'should have printed ARGUMENT WITH FOLDER PACKAGE PASSED');
        assert(tr.stdout.search('ARGUMENT WITH EXCLUDE APP DATA PASSED') > 0, 'should have printed ARGUMENT WITH EXCLUDE APP DATA PASSED');
        assert(tr.stdout.search('ARGUMENT WITH WAR PACKAGE PASSED') > 0, 'should have printed ARGUMENT WITH WAR PACKAGE PASSED');
        assert(tr.stdout.search('ARGUMENT WITH OVERRIDE RETRY FLAG PASSED') > 0, 'should have printed ARGUMENT WITH OVERRIDE RETRY FLAG PASSED');
        done();
    });
});
