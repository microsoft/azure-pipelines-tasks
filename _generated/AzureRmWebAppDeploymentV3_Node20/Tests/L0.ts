import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
var ltx = require('ltx');
import fs = require('fs');

var AppServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service.js");
var KuduServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service-kudu-tests.js");
var ApplicationInsightsTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-appinsights-tests.js");
var fileEncoding = require("../node_modules/azure-pipelines-tasks-webdeployment-common/fileencoding.js");


describe('AzureRmWebAppDeployment Suite', function() {
    
    this.timeout(60000);

     before((done) => {
        if(!tl.exist(path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/node_modules'))) {
            tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests'), '-rf', true);
        }
        done();
    });

    ApplicationInsightsTests.ApplicationInsightsTests();
    AppServiceTests.AzureAppServiceMockTests();
    KuduServiceTests.KuduServiceTests();
});
