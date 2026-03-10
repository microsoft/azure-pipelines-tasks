import tl = require('azure-pipelines-task-lib/task');
import { TaskParameters } from "../taskparameters";
import { BuiltInLinuxWebAppDeploymentProvider } from "./BuiltInLinuxWebAppDeploymentProvider";
import { AzureRmEndpointAuthenticationScheme } from 'azure-pipelines-tasks-azure-arm-rest/constants';

export class AzureWebAppSiteContainersDeploymentProvider extends BuiltInLinuxWebAppDeploymentProvider {
    constructor(taskParams: TaskParameters) {
        super(taskParams);
        tl.debug("AzureWebAppSiteContainersDeploymentProvider initialized with task parameters.");
    }
    
    public async PreDeploymentStep() {

        if (this.taskParams.azureEndpoint.scheme && this.taskParams.azureEndpoint.scheme.toLowerCase() === AzureRmEndpointAuthenticationScheme.PublishProfile) {
            throw new Error(tl.loc('SiteContainersNotSupportedWithPublishProfileAuthentication'));
        }

        // Call the parent class's PreDeploymentStep to ensure all necessary setup is done.
        await super.PreDeploymentStep();
    }

    public async DeployWebAppStep() {
        // The AzureWebAppSiteContainersDeploymentProvider inherits the deployment logic from BuiltInLinuxWebAppDeploymentProvider.

        console.log(tl.loc('StartedUpdatingSiteContainers'));

        for (const siteContainer of this.taskParams.SiteContainers) {
            console.log(tl.loc('UpdatingSiteContainer', siteContainer.getName()));
            await this.appServiceUtility.updateSiteContainer(siteContainer);
        }
        console.log(tl.loc('CompletedUpdatingSiteContainers'));
        
        // Update the blessed app now.
        await super.DeployWebAppStep();
        tl.debug("Deployment for AzureWebAppSiteContainers completed successfully.");
    }
}