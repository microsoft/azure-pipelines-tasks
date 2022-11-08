import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('azure-pipelines-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import * as ParameterParser from 'azure-pipelines-tasks-webdeployment-common-v4/ParameterParserUtility';
import { DeploymentType } from '../operations/TaskParameters';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common-v4/packageUtility';
const oldRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_ZIP';
const runFromZipAppSetting: string = '-WEBSITE_RUN_FROM_PACKAGE 1';
var deployUtility = require('azure-pipelines-tasks-webdeployment-common-v4/utility.js');
var zipUtility = require('azure-pipelines-tasks-webdeployment-common-v4/ziputility.js');

export class WindowsWebAppRunFromZipProvider extends AzureRmWebAppDeploymentProvider{
 
    public async DeployWebAppStep() {
        let deploymentMethodtelemetry = '{"deploymentMethod":"Run from Package"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);

        var webPackage = await FileTransformsUtility.applyTransformations(this.taskParams.Package.getPath(), this.taskParams);
        
        if(this.taskParams.UseWebDeploy && this.taskParams.DeploymentType === DeploymentType.runFromZip) {
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
        
        var addCustomApplicationSetting = ParameterParser.parse(runFromZipAppSetting);
        var deleteCustomApplicationSetting = ParameterParser.parse(oldRunFromZipAppSetting);
        var isNewValueUpdated: boolean = await this.appServiceUtility.updateAndMonitorAppSettings(addCustomApplicationSetting, deleteCustomApplicationSetting);

        if(!isNewValueUpdated) {
            await this.kuduServiceUtility.warmpUp();
        }
        await this.kuduServiceUtility.deployUsingRunFromZip(webPackage, 
            { slotName: this.appService.getSlot() });

        await this.PostDeploymentStep();
    }
    
    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(!this.kuduServiceUtility){
            tl.debug('Kudu service utility not found.');
            return;
        }  
            await super.UpdateDeploymentStatus(isDeploymentSuccess);
     
    }
}