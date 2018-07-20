import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');

var packageUtility = require('webdeployment-common/packageUtility.js');

export class BuiltInLinuxWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider{
    private zipDeploymentID: string;

    public async DeployWebAppStep() {
        tl.debug('Performing Linux built-in package deployment');

        await this.kuduServiceUtility.warmpUp();
        this.zipDeploymentID = await this.kuduServiceUtility.zipDeploy(this.taskParams.Package.getPath(), false, this.taskParams.TakeAppOfflineFlag, 
            { slotName: this.appService.getSlot() });

        await this.appServiceUtility.updateStartupCommandAndRuntimeStack(this.taskParams.RuntimeStack, this.taskParams.StartupCommand);

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