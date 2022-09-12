import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('azure-pipelines-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import * as ParameterParser from 'azure-pipelines-tasks-webdeployment-common-v4/ParameterParserUtility';
import { DeploymentType } from '../operations/TaskParameters';
import { addReleaseAnnotation } from '../operations/ReleaseAnnotationUtility';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common-v4/packageUtility';
const removeRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_PACKAGE -WEBSITE_RUN_FROM_ZIP';
var deployUtility = require('azure-pipelines-tasks-webdeployment-common-v4/utility.js');
var zipUtility = require('azure-pipelines-tasks-webdeployment-common-v4/ziputility.js');

export class WindowsWebAppZipDeployProvider extends AzureRmWebAppDeploymentProvider{
    
    private zipDeploymentID: string;
 
    public async DeployWebAppStep() {
        let deploymentMethodtelemetry = '{"deploymentMethod":"Zip Deploy"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);

        var webPackage = await FileTransformsUtility.applyTransformations(this.taskParams.Package.getPath(), this.taskParams);

        if(this.taskParams.UseWebDeploy && this.taskParams.DeploymentType === DeploymentType.zipDeploy) {
            var _isMSBuildPackage = await this.taskParams.Package.isMSBuildPackage();
            if(_isMSBuildPackage) {
                throw Error(tl.loc("Publishusingzipdeploynotsupportedformsbuildpackage"));
            }
            else if(this.taskParams.VirtualApplication) {
                throw Error(tl.loc("Publishusingzipdeploynotsupportedforvirtualapplication"));
            }
            else if(this.taskParams.Package.getPackageType() === PackageType.war) {
                throw Error(tl.loc("Publishusingzipdeploydoesnotsupportwarfile"));
            }
        }

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

        this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(webPackage, this.taskParams.TakeAppOfflineFlag, 
            { slotName: this.appService.getSlot() });

        await this.PostDeploymentStep();
    }
    
    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            this.activeDeploymentID =  this.kuduServiceUtility.getDeploymentID();
            if(isDeploymentSuccess == false){
                await super.UpdateDeploymentStatus(isDeploymentSuccess);
            }
            else if(this.zipDeploymentID && this.activeDeploymentID && isDeploymentSuccess) {
                
                    await addReleaseAnnotation(this.azureEndpoint, this.appService, isDeploymentSuccess);
                    let appServiceApplicationUrl: string = await this.appServiceUtility.getApplicationURL(!this.taskParams.isLinuxApp 
                        ? this.taskParams.VirtualApplication : null);
                    console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
                    tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
                    await this.kuduServiceUtility.postZipDeployOperation(this.zipDeploymentID, this.activeDeploymentID);
                }
        }
       
    }
}