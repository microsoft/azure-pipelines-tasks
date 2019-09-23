import tl = require("azure-pipelines-task-lib/task");

import env = require("./Environment");
import deployAzureRG = require("../models/AzureVMOperationsTaskParameters");
import winRM = require("./WinRMExtensionHelper");
import dgExtensionHelper = require("./DeploymentGroupExtensionHelper");
import utils = require("./Utils");
import httpInterfaces = require("typed-rest-client/Interfaces");

let proxyUrl: string = tl.getVariable("agent.proxyurl");
var requestOptions: httpInterfaces.IRequestOptions = proxyUrl ? {
    proxy: {
        proxyUrl: proxyUrl,
        proxyUsername: tl.getVariable("agent.proxyusername"),
        proxyPassword: tl.getVariable("agent.proxypassword"),
        proxyBypassHosts: tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null
    }
} : {};

let ignoreSslErrors: string = tl.getVariable("VSTS_ARM_REST_IGNORE_SSL_ERRORS");
requestOptions.ignoreSslError = ignoreSslErrors && ignoreSslErrors.toLowerCase() == "true";

export class ResourceGroup {

    private taskParameters: deployAzureRG.AzureVMOperationsTaskParameters;
    private winRMExtensionHelper: winRM.WinRMExtensionHelper;
    private deploymentGroupExtensionHelper: dgExtensionHelper.DeploymentGroupExtensionHelper;
    private environmentHelper: env.EnvironmentHelper;

    constructor(taskParameters: deployAzureRG.AzureVMOperationsTaskParameters) {
        this.taskParameters = taskParameters;
        this.winRMExtensionHelper = new winRM.WinRMExtensionHelper(this.taskParameters);
        this.deploymentGroupExtensionHelper = new dgExtensionHelper.DeploymentGroupExtensionHelper(this.taskParameters);
        this.environmentHelper = new env.EnvironmentHelper(this.taskParameters);
    }

    public async selectResourceGroup(): Promise<void> {
        if (!utils.isNonEmpty(this.taskParameters.outputVariable) &&
            (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqNone ||
                this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM)) {
            throw tl.loc("OutputVariableShouldNotBeEmpty");
        }

        await this.enableDeploymentPrerequestiesIfRequired();
        await this.registerEnvironmentIfRequired();
    }

    private async registerEnvironmentIfRequired() {
        if (utils.isNonEmpty(this.taskParameters.outputVariable) &&
            (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM ||
                this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqNone)) {
            await this.environmentHelper.RegisterEnvironment();
        }
    }

    private async enableDeploymentPrerequestiesIfRequired() {
        if (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM) {
            await this.winRMExtensionHelper.ConfigureWinRMExtension();
        }
        else if (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqDG) {
            await this.deploymentGroupExtensionHelper.addExtensionOnResourceGroup();
        }
    }

    private enablePrereqDG = "ConfigureVMWithDGAgent";
    private enablePrereqWinRM = "ConfigureVMwithWinRM";
    private enablePrereqNone = "None";
}