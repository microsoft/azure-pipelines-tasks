import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');

var AppServiceTests = require("../node_modules/azurermdeploycommon/Tests/L0-azure-arm-app-service.js");
var KuduServiceTests = require("../node_modules/azurermdeploycommon/Tests/L0-azure-arm-app-service-kudu-tests.js");
var ApplicationInsightsTests = require("../node_modules/azurermdeploycommon/Tests/L0-azure-arm-appinsights-tests.js");
var ResourcesTests = require("../node_modules/azurermdeploycommon/Tests/L0-azure-arm-resource-tests.js");

describe('AzureWebAppDeployment Suite', function() {
    
    this.timeout(60000);

     before((done) => {
        if(!tl.exist(path.join(__dirname, '..', 'node_modules/azurermdeploycommon/Tests/node_modules'))) {
            tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azurermdeploycommon/Tests'), '-rf', true);
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

    it('AzureWebAppDeployment DeploymentFactoryTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'DeploymentFactoryTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('LinuxWebAppDeploymentProvider should be excepted.'), 'Should have printed: LinuxWebAppDeploymentProvider should be expected.'+tr.stdout);
            assert(tr.stdOutContained('WindowsWebAppRunFromZipProvider should be excepted.'), 'Should have printed: WindowsWebAppRunFromZipProvider should be expected.');
            assert(tr.stdOutContained('WindowsWebAppWarDeployProvider should be excepted.'), 'Should have printed: WindowsWebAppWarDeployProvider should be expected.');
            assert(tr.stdOutContained('WindowsWebAppZipDeployProvider should be excepted.'), 'Should have printed: WindowsWebAppZipDeployProvider should be expected.');
            assert(tr.stdOutContained('WindowsWebAppZipDeployProvider for user selected should be excepted.'), 'Should have printed: WindowsWebAppZipDeployProvider for user selected should be excepted.');
            assert(tr.stdOutContained('WindowsWebAppRunFromZipProvider for user selected should be excepted.'), 'Should have printed: WindowsWebAppRunFromZipProvider for user selected should be excepted.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureWebAppDeployment AzureRmWebAppDeploymentProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'AzureRmWebAppDeploymentProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps should succeeded'), 'Should have printed: PreDeployment steps should succeeded');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureWebAppDeployment BuiltInLinuxWebAppDeploymentProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'BuiltInLinuxWebAppDeploymentProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for built in linux web app should succeeded'), 'Should have printed: PreDeployment steps for built in linux web app should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for built in linux web app with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for built in linux web app withSlotEnabled should succeeded');
            assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
            // assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess'+tr.stdout);
            // assert(tr.stdOutContained('Skipped updating the SCM value'), 'Should have printed: Skipped updating the SCM value');
            // assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with zip package succeeded');
            // assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with folder package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with folder package succeeded'); 
            // assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with war package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with war package succeeded');
            // assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with jar package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with jar package succeeded');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureWebAppDeployment WindowsWebAppRunFromZipProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'WindowsWebAppRunFromZipProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for run from zip should succeeded'), 'Should have printed: PreDeployment steps for run from zip should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for run from zip with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for run from zip with slot enabled should succeeded');
            assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
            // assert(tr.stdOutContained('DeployWebAppStep for run from zip steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for run from zip steps with zip package succeeded.')
            // assert(tr.stdOutContained('loc_mock_UpdatingAppServiceApplicationSettings {"WEBSITE_RUN_FROM_PACKAGE":"1"}'), 'Should have printed: loc_mock_UpdatingAppServiceApplicationSettings {"WEBSITE_RUN_FROM_PACKAGE":"1"}');
            // assert(tr.stdOutContained('loc_mock_UpdatedAppServiceApplicationSettings'), 'Should have printed: loc_mock_UpdatedAppServiceApplicationSettings.');
            // assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess.');
            // assert(tr.stdOutContained('Compressed folder into zip webAppPkg.zip'), 'Should have printed: Compressed folder into zip webAppPkg.zip.');
            // assert(tr.stdOutContained('DeployWebAppStep for run from zip steps with folder package succeeded'), 'Should have printed: DeployWebAppStep for run from zip steps with folder package succeeded.');
            
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureWebAppDeployment WindowsWebAppWarDeployProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'WindowsWebAppWarDeployProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for war deploy should succeeded'), 'Should have printed: PreDeployment steps for war deploy should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for war deploy with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for war deploy with slot enabled should succeeded');
            assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');   
            // assert(tr.stdOutContained('DeployWebAppStep for war deploy steps with war package succeeded'), 'Should have printed: DeployWebAppStep for war deploy steps with war package succeeded.')
            // assert(tr.stdOutContained('loc_mock_AppServiceApplicationURL http://mytestapp.azurewebsites.net'), 'Should have printed: loc_mock_AppServiceApplicationURL http://mytestapp.azurewebsites.net');
            // assert(tr.stdOutContained('loc_mock_WarPackageDeploymentInitiated'), 'Should have printed: loc_mock_WarPackageDeploymentInitiated.');
            // assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureWebAppDeployment WindowsWebAppZipDeployProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'WindowsWebAppZipDeployProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for zip deploy should succeeded'), 'Should have printed: PreDeployment steps for zip deploy should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for zip deploy with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for zip deploy with slot enabled should succeeded');
            assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
            // assert(tr.stdOutContained('DeployWebAppStep for zip deploy steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for zip deploy steps with zip package succeeded.'+tr.stdout)
            // assert(tr.stdOutContained('loc_mock_GotconnectiondetailsforazureRMWebApp0 mytestapp'), 'Should have printed: loc_mock_GotconnectiondetailsforazureRMWebApp0 mytestapp');
            // assert(tr.stdOutContained('loc_mock_UpdatingAppServiceApplicationSettings {"WEBSITE_RUN_FROM_PACKAGE":"0"}'), 'Should have printed: loc_mock_UpdatingAppServiceApplicationSettings {"WEBSITE_RUN_FROM_PACKAGE":"0"}.');
            // assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess.');
            // assert(tr.stdOutContained('DeployWebAppStep for zip deploy steps with folder package succeeded'), 'Should have printed: DeployWebAppStep for zip deploy steps with folder package succeeded.');
            // assert(tr.stdOutContained('Compressed folder into zip webAppPkg.zip'), 'Should have printed: Compressed folder into zip webAppPkg.zip.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureWebAppDeployment Validate TaskParameters', (done: MochaDone) => {
        let tp = path.join(__dirname,'TaskParametersTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('SCM_COMMAND_IDLE_TIMEOUT variable PRESENT'), 'Should have printed: SCM_COMMAND_IDLE_TIMEOUT variable PRESENT');
            done();
        }
        catch(error) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            done();
        }
    });

});
