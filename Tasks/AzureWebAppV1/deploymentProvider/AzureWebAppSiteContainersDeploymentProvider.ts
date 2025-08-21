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
        // This method is intentionally left empty as the deployment logic is handled in the parent class.
        // The AzureWebAppSiteContainersDeploymentProvider inherits the deployment logic from BuiltInLinuxWebAppDeploymentProvider.

        for (const siteContainer of this.taskParams.SiteContainers) {
            tl.debug(`Updating SiteContainer: ${siteContainer.getName()}`);
            this.appServiceUtility.updateSiteContainer(siteContainer);
        }

        // Update the blessed app now.
        await super.DeployWebAppStep();
        tl.debug("Deployment for AzureWebAppSiteContainers completed successfully.");
    }
}