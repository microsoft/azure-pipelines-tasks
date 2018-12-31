import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import * as ParameterParser from 'azurermdeploycommon/operations/ParameterParserUtility'
import { DeploymentType } from '../taskparameters';
import { PackageType } from 'azurermdeploycommon/webdeployment-common/packageUtility';
import { FileTransformsUtility } from 'azurermdeploycommon/operations/FileTransformsUtility.js';
const deleteOldRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_ZIP';
const removeRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_PACKAGE 0';
var deployUtility = require('azurermdeploycommon/webdeployment-common/utility.js');
var zipUtility = require('azurermdeploycommon/webdeployment-common/ziputility.js');

export class WindowsWebAppZipDeployProvider extends AzureRmWebAppDeploymentProvider {
    
    private zipDeploymentID: string;
 
    public async DeployWebAppStep() {
        let deploymentMethodtelemetry = '{"deploymentMethod":"Zip Deploy"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);

        var webPackage = await FileTransformsUtility.applyTransformations(this.taskParams.Package.getPath(), this.taskParams.WebConfigParameters, this.taskParams.Package.getPackageType());

        if(this.taskParams.DeploymentType === DeploymentType.zipDeploy) {
            var _isMSBuildPackage = await this.taskParams.Package.isMSBuildPackage();
            if(_isMSBuildPackage) {
                throw Error(tl.loc("Publishusingzipdeploynotsupportedformsbuildpackage"));
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
        
        var updateApplicationSetting = ParameterParser.parse(removeRunFromZipAppSetting)
        var deleteApplicationSetting = ParameterParser.parse(deleteOldRunFromZipAppSetting)
        var isNewValueUpdated: boolean = await this.appServiceUtility.updateAndMonitorAppSettings(updateApplicationSetting, deleteApplicationSetting);

        if(!isNewValueUpdated) {
            await this.kuduServiceUtility.warmpUp();
        }

        this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(webPackage);

        await this.PostDeploymentStep();
    }
    
    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            await super.UpdateDeploymentStatus(isDeploymentSuccess);
            if(this.zipDeploymentID && this.activeDeploymentID && isDeploymentSuccess) {
                await this.kuduServiceUtility.postZipDeployOperation(this.zipDeploymentID, this.activeDeploymentID);
            }
        }
    }
}