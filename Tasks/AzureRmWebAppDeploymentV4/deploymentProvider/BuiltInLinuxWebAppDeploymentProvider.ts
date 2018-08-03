import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { PackageType } from 'webdeployment-common/packageUtility';

var packageUtility = require('webdeployment-common/packageUtility.js');

export class BuiltInLinuxWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider{
    private zipDeploymentID: string;

    public async DeployWebAppStep() {
        tl.debug('Performing Linux built-in package deployment');

        await this.kuduServiceUtility.warmpUp();
        switch(this.taskParams.Package.getPackageType()){
            case PackageType.folder:
            case PackageType.zip:
            case PackageType.jar:
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(this.taskParams.Package.getPath(), this.taskParams.TakeAppOfflineFlag, 
                { slotName: this.appService.getSlot() });
            break;
            case PackageType.war:
            this.zipDeploymentID = await this.kuduServiceUtility.deployUsingWarDeploy(this.taskParams.Package.getPath(), this.taskParams.TakeAppOfflineFlag, 
                { slotName: this.appService.getSlot() });
            break;
            default:
                throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', this.taskParams.Package.getPath()));
        }

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