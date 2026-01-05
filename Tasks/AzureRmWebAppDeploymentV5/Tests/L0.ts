import * as path from "path";
import * as assert from "assert";

import tl = require('azure-pipelines-task-lib');
import * as ttm from "azure-pipelines-task-lib/mock-test";

const AppServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service.js");
const KuduServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service-kudu-tests.js");
const ApplicationInsightsTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-appinsights-tests.js");
const ResourcesTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-resource-tests.js");

const tmpDir = path.join(__dirname, 'temp');
const TIMEOUT_IN_MS = 60 * 1000; // 1 minute

describe('AzureRmWebAppDeployment Suite', function() {
    this.timeout(TIMEOUT_IN_MS);

    this.beforeAll(done => {
        tl.mkdirP(tmpDir);
        done();
    });

    this.afterAll(done => {
        tl.rmRF(tmpDir);
        done();
    });

    before((done) => {
        if (!tl.exist(path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/node_modules'))) {
            tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests'), '-rf', true);
        }

       done();
    });

    ApplicationInsightsTests.ApplicationInsightsTests(TIMEOUT_IN_MS);
    AppServiceTests.AzureAppServiceMockTests(TIMEOUT_IN_MS);
    KuduServiceTests.KuduServiceTests(TIMEOUT_IN_MS);
    ResourcesTests.ResourcesTests(TIMEOUT_IN_MS);

    it('AzureRmWebAppDeploymentV5 DeploymentFactoryTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'DeploymentFactoryTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('LinuxWebAppDeploymentProvider should be excepted.'), 'Should have printed: LinuxWebAppDeploymentProvider should be expected.');
        assert(tr.stdOutContained('WindowsWebAppRunFromZipProvider should be excepted.'), 'Should have printed: WindowsWebAppRunFromZipProvider should be expected.');
        assert(tr.stdOutContained('WindowsWebAppWarDeployProvider should be excepted.'), 'Should have printed: WindowsWebAppWarDeployProvider should be expected.');
        assert(tr.stdOutContained('WindowsWebAppZipDeployProvider should be excepted.'), 'Should have printed: WindowsWebAppZipDeployProvider should be expected.');
        assert(tr.stdOutContained('PublishProfileWebAppDeploymentProvider should be excepted.'), 'Should have printed: PublishProfileWebAppDeploymentProvider should be excepted.');
        assert(tr.stdOutContained('ContainerWebAppDeploymentProvider should be excepted.'), 'Should have printed: ContainerWebAppDeploymentProvider should be excepted.');
        assert(tr.stdOutContained('WindowsWebAppRunFromZipProvider for user selected should be excepted.'), 'Should have printed: WindowsWebAppRunFromZipProvider for user selected should be excepted.');
        assert(tr.stdOutContained('WindowsWebAppZipDeployProvider for user selected should be excepted.'), 'Should have printed: WindowsWebAppZipDeployProvider for user selected should be excepted.');
        assert(tr.stdOutContained('WindowsWebAppWebDeployProvider for user selected should be excepted.'), 'Should have printed: WindowsWebAppWebDeployProvider for user selected should be excepted.');
    });

    it('AzureRmWebAppDeploymentV5 AzureRmWebAppDeploymentProviderTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'AzureRmWebAppDeploymentProviderTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('Resource Group: MOCK_RESOURCE_GROUP_NAME'), 'Should have printed: Resource Group: MOCK_RESOURCE_GROUP_NAME');
        assert(tr.stdOutContained('PreDeployment steps with slot enabled should succeeded'), 'Should have printed: PreDeployment steps withSlotEnabled should succeeded');
        assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
        assert(tr.stdOutContained('PreDeployment steps with virtual application should succeeded'), 'Should have printed: PreDeployment steps with slot enabled should succeeded');
    });

    it('AzureRmWebAppDeploymentV5 BuiltInLinuxWebAppDeploymentProviderTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'BuiltInLinuxWebAppDeploymentProviderTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('PreDeployment steps for built in linux web app should succeeded'), 'Should have printed: PreDeployment steps for built in linux web app should succeeded');
        assert(tr.stdOutContained('PreDeployment steps for built in linux web app with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for built in linux web app withSlotEnabled should succeeded');
        assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
        assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
        assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess');
        assert(tr.stdOutContained('Skipped updating the SCM value'), 'Should have printed: Skipped updating the SCM value');
        assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with zip package succeeded');
        assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with folder package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with folder package succeeded');
        assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with war package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with war package succeeded');
        assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with jar package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with jar package succeeded');
    });

    it('AzureRmWebAppDeploymentV5 ContainerWebAppDeploymentProviderTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'ContainerWebAppDeploymentProviderTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('PreDeployment steps for container web app should succeeded'), 'Should have printed: PreDeployment steps for container web app should succeeded');
        assert(tr.stdOutContained('PreDeployment steps for container web app with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for container web app withSlotEnabled should succeeded');
        assert(tr.stdOutContained('Resource Group: MOCK_RESOURCE_GROUP_NAME'), 'Should have printed: Resource Group: MOCK_RESOURCE_GROUP_NAME');
        assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
        assert(tr.stdOutContained('loc_mock_UpdatingAppServiceConfigurationSettings {"linuxFxVersion":"DOCKER|dockernamespace/dockerrepository:DockerImageTag"}'), 'Should have printed: loc_mock_UpdatingAppServiceConfigurationSettings {"linuxFxVersion":"DOCKER|dockernamespace/dockerrepository:DockerImageTag"}');
        assert(tr.stdOutContained('loc_mock_UpdatedAppServiceConfigurationSettings'), 'Should have printed: loc_mock_UpdatedAppServiceConfigurationSettings');
        assert(tr.stdOutContained('loc_mock_UpdatedAppServiceApplicationSettings') || tr.stdOutContained('loc_mock_AppServiceApplicationSettingsAlreadyPresent'), 'Should have printed: loc_mock_UpdatedAppServiceApplicationSettings or loc_mock_AppServiceApplicationSettingsAlreadyPresent');
        assert(tr.stdOutContained('Web app Deployment steps for container should succeeded'), 'Should have printed: Web app Deployment steps for container should succeeded');
    });

    it('AzureRmWebAppDeploymentV5 WindowsWebAppRunFromZipProviderTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'WindowsWebAppRunFromZipProviderTests.js'));

        await tr.runAsync();
        assert(tr.stdOutContained('PreDeployment steps for run from zip should succeeded'), 'Should have printed: PreDeployment steps for run from zip should succeeded');
        assert(tr.stdOutContained('PreDeployment steps for run from zip with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for run from zip with slot enabled should succeeded');
        assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
        assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
        assert(tr.stdOutContained('DeployWebAppStep for run from zip steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for run from zip steps with zip package succeeded.')
        assert(tr.stdOutContained('DeployWebAppStep for run from zip steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for run from zip steps with zip package succeeded.');
        assert(tr.stdOutContained('loc_mock_UpdatingAppServiceApplicationSettings {"WEBSITE_RUN_FROM_PACKAGE":"1"}'), 'Should have printed: loc_mock_UpdatingAppServiceApplicationSettings {"WEBSITE_RUN_FROM_PACKAGE":"1"}');
        assert(tr.stdOutContained('loc_mock_UpdatedAppServiceApplicationSettings') || tr.stdOutContained('loc_mock_AppServiceApplicationSettingsAlreadyPresent'), 'Should have printed: loc_mock_UpdatedAppServiceApplicationSettings or loc_mock_AppServiceApplicationSettingsAlreadyPresent');
        assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess.');
        assert(tr.stdOutContained('Compressed folder into zip webAppPkg.zip'), 'Should have printed: Compressed folder into zip webAppPkg.zip.');
        assert(tr.stdOutContained('DeployWebAppStep for run from zip steps with folder package succeeded'), 'Should have printed: DeployWebAppStep for run from zip steps with folder package succeeded.');
    });

    it('AzureRmWebAppDeploymentV5 WindowsWebAppWarDeployProviderTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'WindowsWebAppWarDeployProviderTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('PreDeployment steps for war deploy should succeeded'), 'Should have printed: PreDeployment steps for war deploy should succeeded');
        assert(tr.stdOutContained('PreDeployment steps for war deploy with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for war deploy with slot enabled should succeeded');
        assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
        assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
        assert(tr.stdOutContained('DeployWebAppStep for war deploy steps with war package succeeded'), 'Should have printed: DeployWebAppStep for war deploy steps with war package succeeded.')
        assert(tr.stdOutContained('loc_mock_AppServiceApplicationURL http://mytestapp.azurewebsites.net'), 'Should have printed: loc_mock_AppServiceApplicationURL http://mytestapp.azurewebsites.net');
        assert(tr.stdOutContained('loc_mock_WarPackageDeploymentInitiated'), 'Should have printed: loc_mock_WarPackageDeploymentInitiated.');
        assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess.');
    });

    it('AzureRmWebAppDeploymentV5 WindowsWebAppZipDeployProviderTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'WindowsWebAppZipDeployProviderTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('PreDeployment steps for zip deploy should succeeded'), 'Should have printed: PreDeployment steps for zip deploy should succeeded');
        assert(tr.stdOutContained('PreDeployment steps for zip deploy with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for zip deploy with slot enabled should succeeded');
        assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
        assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
        assert(tr.stdOutContained('DeployWebAppStep for zip deploy steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for zip deploy steps with zip package succeeded.')
        assert(tr.stdOutContained('loc_mock_GotconnectiondetailsforazureRMWebApp0 mytestapp'), 'Should have printed: loc_mock_GotconnectiondetailsforazureRMWebApp0 mytestapp');
        assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess.');
        assert(tr.stdOutContained('DeployWebAppStep for zip deploy steps with folder package succeeded'), 'Should have printed: DeployWebAppStep for zip deploy steps with folder package succeeded.');
        assert(tr.stdOutContained('Compressed folder into zip webAppPkg.zip'), 'Should have printed: Compressed folder into zip webAppPkg.zip.');
    });


    it('AzureRmWebAppDeploymentV5 WindowsWebAppWebDeployProviderTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'WindowsWebAppWebDeployProviderTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('PreDeployment steps for web deploy should succeeded'), 'Should have printed: PreDeployment steps for web deploy should succeeded');
        assert(tr.stdOutContained('PreDeployment steps for web deploy with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for web deploy with slot enabled should succeeded');
        assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
        assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
        assert(tr.stdOutContained('DeployWebAppStep for web deploy steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for web deploy steps with zip package succeeded.');
        assert(tr.stdOutContained('DeployWebAppStep for web deploy steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for web deploy steps with zip package succeeded.');
        assert(tr.stdOutContained('loc_mock_GotconnectiondetailsforazureRMWebApp0 mytestapp'), 'Should have printed: loc_mock_GotconnectiondetailsforazureRMWebApp0 mytestapp');
        assert(tr.stdOutContained('loc_mock_AppServiceApplicationURL http://mytestapp.azurewebsites.net'), 'Should have printed: loc_mock_AppServiceApplicationURL http://mytestapp.azurewebsites.net.');
        assert(tr.stdOutContained('loc_mock_Successfullydeployedpackageusingkuduserviceat webAppPkg.zip /site/wwwroot'), 'Should have printed: loc_mock_Successfullydeployedpackageusingkuduserviceat webAppPkg.zip /site/wwwroot.');
        assert(tr.stdOutContained('loc_mock_Successfullydeployedpackageusingkuduserviceat webAppPkg.zip physicalPath'), 'Should have printed: loc_mock_Successfullydeployedpackageusingkuduserviceat webAppPkg.zip physicalPath');
        assert(tr.stdOutContained('DeployWebAppStep for web deploy steps with virtual application with zip package succeeded'), 'Should have printed: DeployWebAppStep for web deploy steps with virtual application with zip package succeeded');
    });

    it('AzureRmWebAppDeploymentV5 PublishProfileWebAppDeploymentProviderTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'PublishProfileWebAppDeploymentProviderTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('PreDeployment steps for publish profile should succeeded'), 'Should have printed: PreDeployment steps for publish profile should succeeded');
        assert(tr.stdOutContained('set AppServiceApplicationUrl=SiteUrl'), 'Should have printed: set AppServiceApplicationUrl=SiteUrl');
        assert(tr.stdOutContained('UpdateDeploymentStatus for publish profile steps should succeeded'), 'Should have printed: UpdateDeploymentStatus for publish profile steps should succeeded');
        assert(tr.stdOutContained('DeployWebAppStep for publish profile steps steps failed with errorError: loc_mock_PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent'), 'Should have printed: DeployWebAppStep for publish profile steps steps failed with errorError: loc_mock_PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent');
    });

    it('AzureRmWebAppDeploymentV5 Validate TaskParameters', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'TaskParametersTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('SCM_COMMAND_IDLE_TIMEOUT variable PRESENT'), 'Should have printed: SCM_COMMAND_IDLE_TIMEOUT variable PRESENT');
        assert(tr.stdOutContained('msbuild package PRESENT'), 'Should have printed: msbuild package PRESENT');
    });
});