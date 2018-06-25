import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import * as Constant from '../operations/Constants';
import * as ParameterParser from '../operations/parameterparser'
import { DeploymentType } from '../operations/TaskParameters';
const removeRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_ZIP 0';

export class WindowsWebAppZipDeployProvider extends AzureRmWebAppDeploymentProvider{
    
    private zipDeploymentID: string;
 
    public async DeployWebAppStep() {
        var webPackage = await FileTransformsUtility.applyTransformations(this.taskParams.Package.getPath(), this.taskParams);

        if(this.taskParams.UseWebDeploy && this.taskParams.DeploymentType === DeploymentType.zipDeploy) {
            var _isMSBuildPackage = await this.taskParams.Package.isMSBuildPackage();
            if(_isMSBuildPackage) {
                throw Error(tl.loc("Publishusingzipdeploynotsupportedformsbuildpackage"));
            }
            else if(this.taskParams.VirtualApplication) {
                throw Error(tl.loc("Publishusingzipdeploynotsupportedforvirtualapplication"));
            }
            else if(this.taskParams.Package.isWarFile()) {
                throw Error(tl.loc("Publishusingzipdeploydoesnotsupportwarfile"));
            }
        }

        tl.debug("Initiated deployment via kudu service for webapp package : ");
        
        var customApplicationSetting = ParameterParser.parse(removeRunFromZipAppSetting)
        await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);

        this.zipDeploymentID = await this.kuduServiceUtility.zipDeploy(webPackage, false, this.taskParams.TakeAppOfflineFlag, 
            { slotName: this.appService.getSlot() });

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