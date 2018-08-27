import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { ContainerBasedDeploymentUtility } from '../operations/ContainerBasedDeploymentUtility';

export class ContainerWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider{

    public async DeployWebAppStep() {
        tl.debug("Performing container based deployment.");
        let containerDeploymentUtility: ContainerBasedDeploymentUtility = new ContainerBasedDeploymentUtility(this.appService);
        await containerDeploymentUtility.deployWebAppImage(this.taskParams);

        await this.appServiceUtility.updateScmTypeAndConfigurationDetails();
    }
}