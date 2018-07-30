import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import * as Constant from '../operations/Constants';
import * as ParameterParser from '../operations/parameterparser'
import { DeploymentType } from '../operations/TaskParameters';
const runFromZipAppSetting: string = '-WEBSITE_RUN_FROM_ZIP 1';

export class WindowsWebAppRunFromZipProvider extends AzureRmWebAppDeploymentProvider{
 
    public async DeployWebAppStep() {
        var webPackage = await FileTransformsUtility.applyTransformations(this.taskParams.Package.getPath(), this.taskParams);

        if(this.taskParams.UseWebDeploy && this.taskParams.DeploymentType === DeploymentType.runFromZip) {
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
        
        var customApplicationSetting = ParameterParser.parse(runFromZipAppSetting);
        await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);

        await this.kuduServiceUtility.zipDeploy(webPackage, true, this.taskParams.TakeAppOfflineFlag, 
            { slotName: this.appService.getSlot() });

        await this.PostDeploymentStep();
    }
    
    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.taskParams.ScriptType && this.kuduServiceUtility) {
            await super.UpdateDeploymentStatus(isDeploymentSuccess);
        }
    }
}