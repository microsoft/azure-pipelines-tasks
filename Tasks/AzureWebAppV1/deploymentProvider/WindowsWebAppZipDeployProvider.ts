import * as ParameterParser from 'azure-pipelines-tasks-azurermdeploycommon/operations/ParameterParserUtility'

import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import { DeploymentType } from '../taskparameters';
import { FileTransformsUtility } from 'azure-pipelines-tasks-azurermdeploycommon/operations/FileTransformsUtility.js';
import { PackageType } from 'azure-pipelines-tasks-azurermdeploycommon/webdeployment-common/packageUtility';

import tl = require('azure-pipelines-task-lib/task');

const removeRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_PACKAGE -WEBSITE_RUN_FROM_ZIP';
var deployUtility = require('azure-pipelines-tasks-azurermdeploycommon/webdeployment-common/utility.js');
var zipUtility = require('azure-pipelines-tasks-azurermdeploycommon/webdeployment-common/ziputility.js');

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
        if (!!this.appServiceUtility) {
            var deleteApplicationSetting = ParameterParser.parse(removeRunFromZipAppSetting)
            var isNewValueUpdated: boolean = await this.appServiceUtility.updateAndMonitorAppSettings(null, deleteApplicationSetting);

            if(!isNewValueUpdated) {
                await this.kuduServiceUtility.warmpUp();
            }
        } else {
            await this.kuduServiceUtility.warmpUp();
        }

        this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(webPackage);

        await this.PostDeploymentStep();
    }
    
    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        await super.UpdateDeploymentStatus(isDeploymentSuccess);
        if(this.kuduServiceUtility) {
            if(this.zipDeploymentID && this.activeDeploymentID && isDeploymentSuccess) {
                await this.kuduServiceUtility.postZipDeployOperation(this.zipDeploymentID, this.activeDeploymentID);
            }
        }
    }
}