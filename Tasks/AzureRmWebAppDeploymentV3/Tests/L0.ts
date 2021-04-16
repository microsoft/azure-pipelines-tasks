import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
var ltx = require('ltx');
import fs = require('fs');

var AppServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/L0-azure-arm-app-service.js");
var KuduServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/L0-azure-arm-app-service-kudu-tests.js");
var ApplicationInsightsTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/L0-azure-arm-appinsights-tests.js");


describe('AzureRmWebAppDeployment Suite', function() {
    
    this.timeout(60000);

     before((done) => {
        if(!tl.exist(path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/node_modules'))) {
            tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests'), '-rf', true);
        }

        tl.cp(path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web.config'), path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.config'), '-f', false);
        tl.cp(path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web.Debug.config'), path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.Debug.config'), '-f', false);
        tl.cp(path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters.xml'), path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters_test.xml'), '-f', false);
        tl.cp(path.join(__dirname, "..", "webdeployment-common","Tests", 'L1XdtTransform', 'Web.config'), path.join(__dirname, "..", "webdeployment-common","Tests", 'L1XdtTransform', 'Web_test.config'), '-f', false);
        done();
    });
    after(function() {
        try {
            tl.rmRF(path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters_test.xml'));
        }
        catch(error) {
            tl.debug(error);
        }
    });

    ApplicationInsightsTests.ApplicationInsightsTests();
    AppServiceTests.AzureAppServiceMockTests();
    KuduServiceTests.KuduServiceTests();

    if (tl.osType().match(/^Win/)) {
        it('Runs successfully with XML Transformation (L1)', (done:MochaDone) => {
            this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

            let tp = path.join(__dirname, "..", "webdeployment-common","Tests","L1XdtTransform.js");
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "webdeployment-common","Tests", 'L1XdtTransform', 'Web_test.config')));
            var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "webdeployment-common","Tests", 'L1XdtTransform','Web_Expected.config')));
            assert(ltx.equal(resultFile, expectFile) , 'Should Transform attributes on Web.config');
            done();
        });
    }
    else {

    }

    it('Runs successfully with XML variable substitution', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1XmlVarSub.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname,  "..", "webdeployment-common","Tests", 'L1XmlVarSub', 'Web_test.config')));
        var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "webdeployment-common","Tests", 'L1XmlVarSub', 'Web_Expected.config')));
        assert(ltx.equal(resultFile, expectFile) , 'Should have substituted variables in Web.config file');
        var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.Debug.config')));
        var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_Expected.Debug.config')));
        assert(ltx.equal(resultFile, expectFile) , 'Should have substituted variables in Web.Debug.config file');   
        var resultParamFile = ltx.parse(fs.readFileSync(path.join(__dirname,  "..", "webdeployment-common","Tests", 'L1XmlVarSub', 'parameters_test.xml')));
        var expectParamFile = ltx.parse(fs.readFileSync(path.join(__dirname,  "..", "webdeployment-common","Tests", 'L1XmlVarSub', 'parameters_Expected.xml')));
        assert(ltx.equal(resultParamFile, expectParamFile) , 'Should have substituted variables in parameters.xml file');

        done();
    });

    it('Runs successfully with JSON variable substitution', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1JsonVarSub.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('JSON - eliminating object variables validated') > 0, 'JSON - eliminating object variables validation error');
        assert(tr.stdout.search('JSON - simple string change validated') > 0,'JSON -simple string change validation error' );
        assert(tr.stdout.search('JSON - system variable elimination validated') > 0, 'JSON -system variable elimination validation error');
        assert(tr.stdout.search('JSON - special variables validated') > 0, 'JSON - special variables validation error');
        assert(tr.stdout.search('JSON - variables with dot character validated') > 0, 'JSON variables with dot character validation error');
        assert(tr.stdout.search('JSON - substitute inbuilt JSON attributes validated') > 0, 'JSON inbuilt variable substitution validation error');
        assert(tr.stdout.search('VALID JSON COMMENTS TESTS PASSED') > 0, 'VALID JSON COMMENTS TESTS PASSED');
        assert(tr.stdout.search('INVALID JSON COMMENTS TESTS PASSED') > 0, 'INVALID JSON COMMENTS TESTS PASSED');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Validate File Encoding', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "webdeployment-common", "Tests", 'L1ValidateFileEncoding.js');
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
        let tp = path.join(__dirname, "..", "webdeployment-common", "Tests", 'L0CopyDirectory.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('## Copy Files Successful ##') >=0, 'should have copied the files');
        assert(tr.stdout.search('## mkdir Successful ##') >= 0, 'should have created dir including dest folder');
        done();
    });
});
