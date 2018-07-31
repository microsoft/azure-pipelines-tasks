import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import * as Constant from '../operations/Constants';
import * as ParameterParser from '../operations/parameterparser'
import { DeploymentType } from '../operations/TaskParameters';
import { PackageType } from 'webdeployment-common/packageUtility';
const runFromZipAppSetting: string = '-WEBSITE_RUN_FROM_ZIP 1';

export class WindowsWebAppWarDeployProvider extends AzureRmWebAppDeploymentProvider{
    
    private zipDeploymentID: string;

    public async DeployWebAppStep() {
        var webPackage = await FileTransformsUtility.applyTransformations(this.taskParams.Package.getPath(), this.taskParams);

        tl.debug("Initiated deployment via kudu service for webapp war package : "+ webPackage);

        this.zipDeploymentID = await this.kuduServiceUtility.deployUsingWarDeploy(webPackage, true, this.taskParams.TakeAppOfflineFlag, 
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