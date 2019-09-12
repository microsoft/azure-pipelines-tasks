import deployAzureRG = require("../models/DeployAzureRG");
import armResource = require("azure-arm-rest-v2/azure-arm-management-group");
import { DeploymentScopeBase } from "./DeploymentScopeBase";
import { DeploymentParameters } from "./DeploymentParameters";

export class ManagementGroup extends DeploymentScopeBase {


    constructor(managementGroupManagementClient: armResource.ManagementGroupManagementClient, taskParameters: deployAzureRG.AzureRGTaskParameters) {
        var deploymentParameters = new DeploymentParameters({}, taskParameters.location);
        super(managementGroupManagementClient, taskParameters, deploymentParameters);
    }

    public async deploy(): Promise<void> {
        await this.createTemplateDeployment();
    }
}