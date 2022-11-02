import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
var ltx = require('ltx');
import fs = require('fs');

var AppServiceTests = require("../node_modules/azure-pipelines-tasks-azurermdeploycommon-v3/Tests/L0-azure-arm-app-service.js");
var KuduServiceTests = require("../node_modules/azure-pipelines-tasks-azurermdeploycommon-v3/Tests/L0-azure-arm-app-service-kudu-tests.js");
var ApplicationInsightsTests = require("../node_modules/azure-pipelines-tasks-azurermdeploycommon-v3/Tests/L0-azure-arm-appinsights-tests.js");
var ResourcesTests = require("../node_modules/azure-pipelines-tasks-azurermdeploycommon-v3/Tests/L0-azure-arm-resource-tests.js");

describe('AzureWebAppDeployment Suite', function() {
    
    this.timeout(60000);

     before((done) => {
        if(!tl.exist(path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azurermdeploycommon-v3/Tests/node_modules'))) {
            tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azurermdeploycommon-v3/Tests'), '-rf', true);
        }

        done();
    });

    ApplicationInsightsTests.ApplicationInsightsTests();
    AppServiceTests.AzureAppServiceMockTests();
    KuduServiceTests.KuduServiceTests();
    ResourcesTests.ResourcesTests(); 

    it('Validate operations.ParameterParserUtility.parse()', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0ParameterParserUtility.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('PARAMETERPARSERUTILITY CASE 1 PASSED') >=0, 'should have printed PARAMETERPARSERUTILITY CASE 1 PASSED');
        assert(tr.stdout.search('PARAMETERPARSERUTILITY CASE 2 WITH EMPTY VALUE PASSED') >= 0, 'should have printed PARAMETERPARSERUTILITY CASE 2 WITH EMPTY VALUE PASSED');
        assert(tr.stdout.search('PARAMETERPARSERUTILITY CASE 3 WITH EXTRA SPACES PASSED') >= 0, 'should have printed PARAMETERPARSERUTILITY CASE 3 WITH EXTRA SPACES PASSED');
        done();
    });

    it('AzureWebAppDeployment AzureRmWebAppDeploymentProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'AzureRmWebAppDeploymentProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for container web app should succeeded'), 'Should have printed: PreDeployment steps for container web app should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for container web app with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for container web app withSlotEnabled should succeeded');
            assert(tr.stdOutContained('Resource Group: MOCK_RESOURCE_GROUP_NAME'), 'Should have printed: Resource Group: MOCK_RESOURCE_GROUP_NAME');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.'+tr.stdout);
            assert(tr.stdOutContained('loc_mock_UpdatingAppServiceConfigurationSettings {"appCommandLine":null,"linuxFxVersion":"DOCKER|dockernamespace/dockerrepository:DockerImageTag"}'), 'Should have printed: loc_mock_UpdatingAppServiceConfigurationSettings {"appCommandLine":null,"linuxFxVersion":"DOCKER|dockernamespace/dockerrepository:DockerImageTag"}');
            assert(tr.stdOutContained('loc_mock_UpdatedAppServiceConfigurationSettings'), 'Should have printed: loc_mock_UpdatedAppServiceConfigurationSettings');
            assert(tr.stdOutContained('loc_mock_UpdatedAppServiceApplicationSettings') || tr.stdOutContained('loc_mock_AppServiceApplicationSettingsAlreadyPresent'), 'Should have printed: loc_mock_UpdatedAppServiceApplicationSettings or loc_mock_AppServiceApplicationSettingsAlreadyPresent');
            assert(tr.stdOutContained('loc_mock_RestartingAppService mytestapp'), 'Should have printed: loc_mock_RestartingAppService mytestapp');
            assert(tr.stdOutContained('loc_mock_RestartedAppService mytestapp'), 'Should have printed: loc_mock_RestartedAppService mytestapp');
            assert(tr.stdOutContained('Web app Deployment steps for container should succeeded'), 'Should have printed: Web app Deployment steps for container should succeeded');
            done();
        }
        catch(error) {
            done(error);
        }
    });

});
