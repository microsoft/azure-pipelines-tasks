import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';
var AppServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service.js");
var KuduServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service-kudu-tests.js");
var ApplicationInsightsTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-appinsights-tests.js");
var AppInsightsWebTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-appinsights-webtests-tests.js");
var ResourcesTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-resource-tests.js");

describe('Azure App Service Manage Suite', function() {

    this.timeout(60000);

    before((done) => {
        try {
            if(!tl.exist(path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/node_modules'))) {
                tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests'), '-rf', true);
            }
        }
        catch(error) {
            tl.debug(error);
        }

        done();
    });
    
    after(function () {
    });
    
    ApplicationInsightsTests.ApplicationInsightsTests();
    AppServiceTests.AzureAppServiceMockTests();
    KuduServiceTests.KuduServiceTests();
    AppInsightsWebTests.ApplicationInsightsTests();
    ResourcesTests.ResourcesTests();
});