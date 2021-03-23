import * as ParameterParser from 'azure-pipelines-tasks-azurermdeploycommon/operations/ParameterParserUtility'

import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import { DeploymentType } from '../taskparameters';
import { FileTransformsUtility } from 'azure-pipelines-tasks-azurermdeploycommon/operations/FileTransformsUtility.js';
import { PackageType } from 'azure-pipelines-tasks-azurermdeploycommon/webdeployment-common/packageUtility';
import { addReleaseAnnotation } from 'azure-pipelines-tasks-azurermdeploycommon/operations/ReleaseAnnotationUtility';

import tl = require('azure-pipelines-task-lib/task');

var deployUtility = require('azure-pipelines-tasks-azurermdeploycommon/webdeployment-common/utility.js');
var zipUtility = require('azure-pipelines-tasks-azurermdeploycommon/webdeployment-common/ziputility.js');

const oldRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_ZIP';
const runFromZipAppSetting: string = '-WEBSITE_RUN_FROM_PACKAGE 1';

export class WindowsWebAppRunFromZipProvider extends AzureRmWebAppDeploymentProvider {
 
    public async DeployWebAppStep() {
        let deploymentMethodtelemetry = '{"deploymentMethod":"Run from Package"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);

        var webPackage = await FileTransformsUtility.applyTransformations(this.taskParams.Package.getPath(), this.taskParams.WebConfigParameters, this.taskParams.Package.getPackageType());
        
        if(this.taskParams.DeploymentType === DeploymentType.runFromPackage) {
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

        tl.debug("Initiated deployment via kudu service for webapp package : " + webPackage);
        if (!!this.appServiceUtility) {
            var addCustomApplicationSetting = ParameterParser.parse(runFromZipAppSetting);
            var deleteCustomApplicationSetting = ParameterParser.parse(oldRunFromZipAppSetting);
            var isNewValueUpdated: boolean = await this.appServiceUtility.updateAndMonitorAppSettings(addCustomApplicationSetting, deleteCustomApplicationSetting);

            if(!isNewValueUpdated) {
                await this.kuduServiceUtility.warmpUp();
            }
        } else {
            await this.kuduServiceUtility.warmpUp();
        }

        await this.kuduServiceUtility.deployUsingRunFromZip(webPackage, 
            { slotName: this.slotName });

        await this.PostDeploymentStep();
    }

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(!!this.appService) {
            await addReleaseAnnotation(this.taskParams.azureEndpoint, this.appService, isDeploymentSuccess);
        }

        let appServiceApplicationUrl: string;
        if (!!this.appServiceUtility) {
            appServiceApplicationUrl = await this.appServiceUtility.getApplicationURL();
        } else {
            appServiceApplicationUrl = this.publishProfileScmCredentials.applicationUrl;
        }
        console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
        tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
    }
}