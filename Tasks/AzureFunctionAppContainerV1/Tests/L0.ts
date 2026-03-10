import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as fs from 'fs';
var AppServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service.js");
var KuduServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service-kudu-tests.js");
var ApplicationInsightsTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-appinsights-tests.js");
var ResourcesTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-resource-tests.js");

describe('AzureFunctionOnContainerDeployment Suite', function() {

    this.timeout(120000);

     before(async () => {
        // Create required temp directories for tests
        const tempDir = "C:\\temp\\agent\\home\\temp";
        const sourcesDir = "C:\\temp\\agent\\home\\sources";
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        if (!fs.existsSync(sourcesDir)) {
            fs.mkdirSync(sourcesDir, { recursive: true });
        }
        
        if(!tl.exist(path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/node_modules'))) {
            tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests'), '-rf', true);
        }
    });

    ApplicationInsightsTests.ApplicationInsightsTests(60000);
    AppServiceTests.AzureAppServiceMockTests();
    KuduServiceTests.KuduServiceTests(60000);
    ResourcesTests.ResourcesTests(); 

    it('Validate operations.ParameterParserUtility.parse()', async () => {
        let tp = path.join(__dirname, 'L0ParameterParserUtility.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.stdout.search('PARAMETERPARSERUTILITY CASE 1 PASSED') >=0, 'should have printed PARAMETERPARSERUTILITY CASE 1 PASSED');
        assert(tr.stdout.search('PARAMETERPARSERUTILITY CASE 2 WITH EMPTY VALUE PASSED') >= 0, 'should have printed PARAMETERPARSERUTILITY CASE 2 WITH EMPTY VALUE PASSED');
        assert(tr.stdout.search('PARAMETERPARSERUTILITY CASE 3 WITH EXTRA SPACES PASSED') >= 0, 'should have printed PARAMETERPARSERUTILITY CASE 3 WITH EXTRA SPACES PASSED');
    });

    it('AzureFunctionOnContainerDeployment AzureFunctionOnContainerDeploymentProviderTests', async () => {
        let tp = path.join(__dirname,'AzureRmWebAppDeploymentProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('PreDeployment steps for container web app should succeeded'), 'Should have printed: PreDeployment steps for container web app should succeeded');
        assert(tr.stdOutContained('PreDeployment steps for container web app with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for container web app withSlotEnabled should succeeded');
        assert(tr.stdOutContained('Resource Group: MOCK_RESOURCE_GROUP_NAME'), 'Should have printed: Resource Group: MOCK_RESOURCE_GROUP_NAME');
        assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
        assert(tr.stdOutContained('loc_mock_RestartingAppService mytestapp'), 'Should have printed: loc_mock_RestartingAppService mytestapp');
        assert(tr.stdOutContained('loc_mock_RestartedAppService mytestapp'), 'Should have printed: loc_mock_RestartedAppService mytestapp');
        assert(tr.stdOutContained('loc_mock_UpdatingAppServiceConfigurationSettings {"appCommandLine":null,"linuxFxVersion":"DOCKER|dockernamespace/dockerrepository:DockerImageTag"}'), 'Should have printed: loc_mock_UpdatingAppServiceConfigurationSettings {"appCommandLine":null,"linuxFxVersion":"DOCKER|dockernamespace/dockerrepository:DockerImageTag"}');
        assert(tr.stdOutContained('loc_mock_UpdatedAppServiceConfigurationSettings'), 'Should have printed: loc_mock_UpdatedAppServiceConfigurationSettings');
        assert(tr.stdOutContained('loc_mock_UpdatedAppServiceApplicationSettings') || tr.stdOutContained('loc_mock_AppServiceApplicationSettingsAlreadyPresent'), 'Should have printed: loc_mock_UpdatedAppServiceApplicationSettings or loc_mock_AppServiceApplicationSettingsAlreadyPresent');
        assert(tr.stdOutContained('Web app Deployment steps for container should succeeded'), 'Should have printed: Web app Deployment steps for container should succeeded');
    });

});