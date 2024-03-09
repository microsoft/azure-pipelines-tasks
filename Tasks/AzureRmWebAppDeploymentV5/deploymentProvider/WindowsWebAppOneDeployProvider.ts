import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('azure-pipelines-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import * as ParameterParser from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';
import { DeploymentType, TaskParameters } from '../operations/TaskParameters';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
const removeRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_PACKAGE -WEBSITE_RUN_FROM_ZIP';
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var zipUtility = require('azure-pipelines-tasks-webdeployment-common/ziputility.js');

export class WindowsWebAppOneDeployProvider extends AzureRmWebAppDeploymentProvider{
    
    private deploymentId: string;
 
    public async DeployWebAppStep() {
        let deploymentMethodtelemetry = '{"deploymentMethod":"OneDeploy"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);

        var webPackage = await FileTransformsUtility.applyTransformations(this.taskParams.Package.getPath(), this.taskParams);

        if(tl.stats(webPackage).isDirectory()) {
            let tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
            webPackage = await zipUtility.archiveFolder(webPackage, "", tempPackagePath);
            tl.debug("Compressed folder into zip " +  webPackage);
        }

        tl.debug("Initiated deployment via kudu service for webapp package : ");
        
        var deleteApplicationSetting = ParameterParser.parse(removeRunFromZipAppSetting);
        var isNewValueUpdated: boolean = await this.appServiceUtility.updateAndMonitorAppSettings(null, deleteApplicationSetting);

        if(!isNewValueUpdated) {
            await this.kuduServiceUtility.warmpUp();
        }

        let validOneDeployTypes = ["war", "jar", "ear", "zip", "static"];
        if (this.taskParams.OneDeployType != null && validOneDeployTypes.includes(this.taskParams.OneDeployType.toLowerCase())) {
            tl.debug("Initiated deployment via kudu service for webapp" + this.taskParams.OneDeployType + " package : " + webPackage);
        }
        else {
            let packageType = this.taskParams.Package.getPackageType();
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

        this.deploymentId = await this.kuduServiceUtility.deployUsingOneDeploy(webPackage, this.taskParams, { slotName: this.appService.getSlot() });

        await this.PostDeploymentStep();
    }
    
    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            await super.UpdateDeploymentStatus(isDeploymentSuccess);
            if(this.deploymentId && this.activeDeploymentID && isDeploymentSuccess) {
                await this.kuduServiceUtility.postZipDeployOperation(this.deploymentId, this.activeDeploymentID);
            }
        }
      
    }
}