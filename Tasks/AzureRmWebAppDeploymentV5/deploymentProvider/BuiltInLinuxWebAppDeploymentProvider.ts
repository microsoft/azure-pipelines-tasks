import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('azure-pipelines-task-lib/task');
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import path = require('path');
import * as ParameterParser from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';

var webCommonUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var zipUtility = require('azure-pipelines-tasks-webdeployment-common/ziputility.js');

const linuxFunctionStorageSetting: string = '-WEBSITES_ENABLE_APP_SERVICE_STORAGE true';
const linuxFunctionRuntimeSettingName: string = '-FUNCTIONS_WORKER_RUNTIME ';

const linuxFunctionRuntimeSettingValue = new Map([
    [ 'DOCKER|microsoft/azure-functions-dotnet-core2.0:2.0', 'dotnet ' ],
    [ 'DOCKER|microsoft/azure-functions-node8:2.0', 'node ' ],
    [ 'DOCKER|microsoft/azure-functions-python3.6:2.0', 'python '],
    [ 'DOTNET|2.2', 'dotnet ' ],
    [ 'DOTNET|3.1', 'dotnet ' ],
    [ 'JAVA|8', 'java ' ],
    [ 'JAVA|11', 'java ' ],
    [ 'NODE|8', 'node ' ],
    [ 'NODE|10', 'node ' ],
    [ 'NODE|12', 'node ' ],
    [ 'NODE|14', 'node ' ],
    [ 'PYTHON|3.6', 'python '],
    [ 'PYTHON|3.7', 'python '],
    [ 'PYTHON|3.8', 'python ']
]);

export class BuiltInLinuxWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider{
    private deploymentID: string;

    public async DeployWebAppStep() {
        let packageType = this.taskParams.Package.getPackageType();
        let webPackage = this.taskParams.Package.getPath();
        let deploymentMethodtelemetry = '{"deploymentMethod":"OneDeploy"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);

        tl.debug('Performing Linux built-in package deployment');
        var isNewValueUpdated: boolean = false;

        if(this.taskParams.isFunctionApp) {
            var linuxFunctionRuntimeSetting = "";
            if(this.taskParams.RuntimeStack){
                linuxFunctionRuntimeSetting = linuxFunctionRuntimeSettingName + linuxFunctionRuntimeSettingValue.get(this.taskParams.RuntimeStack);
            }
            var linuxFunctionAppSetting = linuxFunctionRuntimeSetting + linuxFunctionStorageSetting;
            var customApplicationSetting = ParameterParser.parse(linuxFunctionAppSetting);
            isNewValueUpdated = await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);
        }
        
        if(!isNewValueUpdated) {
            await this.kuduServiceUtility.warmpUp();
        }

        if (tl.stats(webPackage).isDirectory()) {
            let tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
            webPackage = await zipUtility.archiveFolder(webPackage, "", tempPackagePath);
            tl.debug("Compressed folder into zip " + webPackage);
        }

        let validOneDeployTypes = ["war", "jar", "ear", "zip", "static"];
        if (this.taskParams.OneDeployType != null && validOneDeployTypes.includes(this.taskParams.OneDeployType.toLowerCase())) {
            tl.debug("Initiated deployment via kudu service for webapp" + this.taskParams.OneDeployType + " package : " + webPackage);
        }
        else {
            switch (packageType) {
                case PackageType.war:
                    tl.debug("Initiated deployment via kudu service for webapp WAR package : " + webPackage);
                    this.taskParams.OneDeployType = "war";
                    break;
                case PackageType.jar:
                    tl.debug("Initiated deployment via kudu service for webapp JAR package : " + webPackage);
                    this.taskParams.OneDeployType = "jar";
                    break;
                case PackageType.zip:
                    tl.debug("Initiated deployment via kudu service for webapp ZIP package : " + webPackage);
                    this.taskParams.OneDeployType = "zip";
                    break;
                default:
                    throw new Error('Invalid App Service package: ' + webPackage + ' or type provided: ' + this.taskParams.OneDeployType);
            }
        }
        this.deploymentID = await this.kuduServiceUtility.deployUsingOneDeploy(webPackage, this.taskParams, { slotName: this.appService.getSlot() });

        await this.appServiceUtility.updateStartupCommandAndRuntimeStack(this.taskParams.RuntimeStack, this.taskParams.StartupCommand);

        await this.PostDeploymentStep();
    }

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            await super.UpdateDeploymentStatus(isDeploymentSuccess);
            if(this.deploymentID && this.activeDeploymentID && isDeploymentSuccess) {
                await this.kuduServiceUtility.postZipDeployOperation(this.deploymentID, this.activeDeploymentID);
            }
        }
    }
}