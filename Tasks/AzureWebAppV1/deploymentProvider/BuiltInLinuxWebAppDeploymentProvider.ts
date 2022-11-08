import * as ParameterParser from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/ParameterParserUtility'

import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import { PackageType } from 'azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/packageUtility';

import tl = require('azure-pipelines-task-lib/task');

var webCommonUtility = require('azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/utility.js');
var deployUtility = require('azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/utility.js');
var zipUtility = require('azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/ziputility.js');

const initScriptAppSetting: string = "-INIT_SCRIPT";

export class BuiltInLinuxWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider {
    private zipDeploymentID: string;

    public async DeployWebAppStep() {
        let packageType = this.taskParams.Package.getPackageType();
        let deploymentMethodtelemetry = packageType === PackageType.war ? '{"deploymentMethod":"War Deploy"}' : '{"deploymentMethod":"Zip Deploy"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);
        
        tl.debug('Performing Linux built-in package deployment');
        
        await this.kuduServiceUtility.warmpUp();
        
        switch(packageType){
            case PackageType.folder:
                let tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
                let archivedWebPackage = await zipUtility.archiveFolder(this.taskParams.Package.getPath(), "", tempPackagePath);
                tl.debug("Compressed folder into zip " +  archivedWebPackage);
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(archivedWebPackage);
            break;
            case PackageType.zip:
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(this.taskParams.Package.getPath());
            break;

            case PackageType.jar:
                tl.debug("Initiated deployment via kudu service for webapp jar package : "+ this.taskParams.Package.getPath());
                let folderPath = await webCommonUtility.generateTemporaryFolderForDeployment(false, this.taskParams.Package.getPath(), PackageType.jar);
                let output = await webCommonUtility.archiveFolderForDeployment(false, folderPath);
                let webPackage = output.webDeployPkg;
                let deleteCustomApplicationSetting = ParameterParser.parse(initScriptAppSetting);
                await this.appServiceUtility.updateAndMonitorAppSettings(null, deleteCustomApplicationSetting);
                tl.debug("Initiated deployment via kudu service for webapp jar package : "+ webPackage);
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(webPackage);
            break;

            case PackageType.war:
                tl.debug("Initiated deployment via kudu service for webapp war package : "+ this.taskParams.Package.getPath());
                let warName = this.taskParams.CustomWarName || webCommonUtility.getFileNameFromPath(this.taskParams.Package.getPath(), ".war");
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingWarDeploy(this.taskParams.Package.getPath(),
                { slotName: this.appService.getSlot() }, warName);
            break;

            default:
                throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', this.taskParams.Package.getPath()));
        }

        await this.appServiceUtility.updateStartupCommandAndRuntimeStack(this.taskParams.RuntimeStack, this.taskParams.StartupCommand);

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