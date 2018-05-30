import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import { DeployWar } from '../operations/WarDeploymentUtilities';
import * as Constant from '../operations/Constants';
import { WebDeployUtility } from '../operations/WebDeployUtility';
import { AzureAppServiceUtility } from '../operations/AzureAppServiceUtility';
import { Package } from 'webdeployment-common/packageUtility';
import * as ParameterParser from '../operations/parameterparser'

var packageUtility = require('webdeployment-common/packageUtility.js');
var deployUtility = require('webdeployment-common/utility.js');
var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');
const runFromZipAppSetting: string = '-WEBSITE_RUN_FROM_ZIP 1';

export class WindowsWebAppZipDeployProvider extends AzureRmWebAppDeploymentProvider{
    
    private zipDeploymentID: string;
    private runFromZip: boolean;
 
    public async DeployWebAppStep() {
        var webPackage = await FileTransformsUtility.applyTransformations(this.taskParams.Package.getPath(), this.taskParams);

        if(this.taskParams.DeploymentType === "zipDeploy") {

            var _isMSBuildPackage = await this.taskParams.Package.isMSBuildPackage(); 
            if(_isMSBuildPackage) {
                throw Error(tl.loc("Publishusingzipdeploynotsupportedformsbuildpackage"));
            }
            else if(this.taskParams.VirtualApplication) {
                throw Error(tl.loc("Publishusingzipdeploynotsupportedforvirtualapplication"));
            }

            await this.deployUsingZipDeploy(webPackage, this.taskParams.UseRunFromZip);
        }
        // if post deployment script is present or app offline flag is checked for a non function app we use pure zipDeploy
        else if(this.taskParams.ScriptType || (this.taskParams.WebAppKind !== "functionApp" && this.taskParams.TakeAppOfflineFlag)) {
            await this.deployUsingZipDeploy(webPackage, false);
        }
        else {
            await this.deployUsingZipDeploy(webPackage, true);
        }

        await this.PostDeploymentStep();
    }

    private async deployUsingZipDeploy(webPackage, runFromZip: boolean) {
        tl.debug("Initiated deployment via kudu service for webapp package : ");

        if(runFromZip) {
            var customApplicationSetting = ParameterParser.parse(runFromZipAppSetting);
            await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);
        }

        this.zipDeploymentID = await this.kuduServiceUtility.zipDeploy(webPackage, runFromZip, this.taskParams.TakeAppOfflineFlag, 
            { slotName: this.appService.getSlot() });

        this.runFromZip = runFromZip; 
    }
    
    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if((!this.runFromZip || (this.runFromZip && this.taskParams.ScriptType)) && this.kuduServiceUtility) {
            await super.UpdateDeploymentStatus(isDeploymentSuccess);
            if(!this.runFromZip && this.zipDeploymentID && this.activeDeploymentID && isDeploymentSuccess) {
                await this.kuduServiceUtility.postZipDeployOperation(this.zipDeploymentID, this.activeDeploymentID);
            }
        }
    }
}