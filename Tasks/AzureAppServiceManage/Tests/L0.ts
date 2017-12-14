import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
import * as path from 'path';
var azure_arm_rest_common_tests = require("../node_modules/azure-arm-rest/Tests/L0.js");

describe('Azure App Service Manage Suite', function() {

    this.timeout(5000);

    before((done) => {
        try {
            tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-arm-rest'), '-rf', true);
        }
        catch(error) {
            tl.debug(error);
        }

        done();
    });
    
    after(function () {
    });
    
    azure_arm_rest_common_tests.AzureAppServiceMockTests();
    
    /*
    it('Action: Azure App Service', (done: MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "azure-arm-rest", "Tests", 'azure-arm-app-service-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        AppServiceMocksTests.AzureAppServiceMockTests();

        done();
    });
    /*
    it('Install Extensions successfully', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0ExtensionManageSuccess.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('Retrieved list of extensions already available in Azure App Service.'), 'Should have retrieved extensions already avaliable in Azure App Service.');
        assert(tr.stdOutContained('InstallingSiteExtension python2713x86'), 'Should have tried to Install extension.');
        assert(tr.stdOutContained('ExtensionInstallSuccess Python 2.7.13 x86'), 'Should have installed extension successfully.');
        done();
    });
    it('Return error when List Extension fails', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0ExtensionManageListFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdOutContained('ExtensionListFailedResponseError'), 'Should have failed when extension list failed.');
        done();
    });
    it('Return error when Extension install fails', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0ExtensionManageInstallFail.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdOutContained('ExtensionInstallFailedResponseError'), 'Should have failed when extension install failed.');
        done();
    });
    */
});