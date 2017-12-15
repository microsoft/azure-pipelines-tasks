import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
import * as path from 'path';
var azure_arm_rest_common_app_service_tests = require("../node_modules/azure-arm-rest/Tests/L0-azure-arm-app-service.js");
var azure_arm_rest_common_kudu_tests = require("../node_modules/azure-arm-rest/Tests/L0-azure-arm-app-service-kudu-tests.js");
var azure_arm_appinsights_tests = require("../node_modules/azure-arm-rest/Tests/L0-azure-arm-appinsights-tests.js");
describe('Azure App Service Manage Suite', function() {

    this.timeout(60000);

    before((done) => {
        try {
            if(!tl.exist(path.join(__dirname, '..', 'node_modules/azure-arm-rest/node_modules'))) {
                tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-arm-rest'), '-rf', true);
            }
        }
        catch(error) {
            tl.debug(error);
        }

        done();
    });
    
    after(function () {
    });
    
    // azure_arm_appinsights_tests.ApplicationInsightsTests();
    azure_arm_rest_common_app_service_tests.AzureAppServiceMockTests();
    // azure_arm_rest_common_kudu_tests.KuduServiceTests();
});