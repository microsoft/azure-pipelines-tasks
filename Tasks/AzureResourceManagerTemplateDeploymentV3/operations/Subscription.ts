import deployAzureRG = require("../models/DeployAzureRG");
import armResource = require("azure-arm-rest-v2/azure-arm-subscription");
import { DeploymentScopeBase } from "./DeploymentScopeBase";
import { DeploymentParameters } from "./DeploymentParameters";

export class Subscription extends DeploymentScopeBase {

    constructor(subscriptionManagementClient: armResource.SubscriptionManagementClient, taskParameters: deployAzureRG.AzureRGTaskParameters) {
        var deploymentParameters = new DeploymentParameters({}, taskParameters.location);
        super(subscriptionManagementClient, taskParameters, deploymentParameters);
    }

    public async deploy(): Promise<void> {
        await this.createTemplateDeployment();
    }
}