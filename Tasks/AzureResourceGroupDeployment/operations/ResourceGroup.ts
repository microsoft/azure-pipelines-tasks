import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

import env = require("./Environment");
import deployAzureRG = require("../models/DeployAzureRG");
import armResource = require("azure-arm-rest/azure-arm-resource");
import winRM = require("./WinRMExtensionHelper");
import dgExtensionHelper = require("./DeploymentGroupExtensionHelper");
var parameterParser = require("./ParameterParser").parse;
import utils = require("./Utils");
import fileEncoding = require('./FileEncoding');

var httpClient = require('vso-node-api/HttpClient');
var httpObj = new httpClient.HttpCallbackClient("VSTS_AGENT");

function stripJsonComments(content) {
    if (!content || (content.indexOf("//") < 0 && content.indexOf("/*") < 0)) {
        return content;
    }

    var currentChar;
    var nextChar;
    var insideQuotes = false;
    var contentWithoutComments = '';
    var insideComment = 0;
    var singlelineComment = 1;
    var multilineComment = 2;

    for (var i = 0; i < content.length; i++) {
        currentChar = content[i];
        nextChar = i + 1 < content.length ? content[i + 1] : "";

        if (insideComment) {
            var update = false;
            if (insideComment == singlelineComment && (currentChar + nextChar === '\r\n' || currentChar === '\n')) {
                i--;
                insideComment = 0;
                continue;
            }

            if (insideComment == multilineComment && currentChar + nextChar === '*/') {
                i++;
                insideComment = 0;
                continue;
            }

        } else {
            if (insideQuotes && currentChar == "\\") {
                contentWithoutComments += currentChar + nextChar;
                i++; // Skipping checks for next char if escaped
                continue;
            }
            else {
                if (currentChar == '"') {
                    insideQuotes = !insideQuotes;
                }

                if (!insideQuotes) {
                    if (currentChar + nextChar === '//') {
                        insideComment = singlelineComment;
                        i++;
                    }

                    if (currentChar + nextChar === '/*') {
                        insideComment = multilineComment;
                        i++;
                    }
                }
            }
        }

        if (!insideComment) {
            contentWithoutComments += content[i];
        }
    }

    return contentWithoutComments;
}

class Deployment {
    public properties: Object;

    constructor(properties: Object) {
        this.properties = properties;
    }
    public updateCommonProperties(mode: string) {
        this.properties["mode"] = mode;
    }
}

export class ResourceGroup {

    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private winRMExtensionHelper: winRM.WinRMExtensionHelper;
    private deploymentGroupExtensionHelper: dgExtensionHelper.DeploymentGroupExtensionHelper;
    private environmentHelper: env.EnvironmentHelper;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.winRMExtensionHelper = new winRM.WinRMExtensionHelper(this.taskParameters);
        this.deploymentGroupExtensionHelper = new dgExtensionHelper.DeploymentGroupExtensionHelper(this.taskParameters);
        this.environmentHelper = new env.EnvironmentHelper(this.taskParameters);
    }

    public async createOrUpdateResourceGroup(): Promise<void> {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        await this.createResourceGroupIfRequired(armClient);
        await this.createTemplateDeployment(armClient);
        await this.enableDeploymentPrerequestiesIfRequired(armClient);
        await this.registerEnvironmentIfRequired(armClient);
    }

    public deleteResourceGroup(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            var extDelPromise = this.deploymentGroupExtensionHelper.deleteExtensionFromResourceGroup();
            var deleteRG = (val) => {
                var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
                console.log(tl.loc("DeletingResourceGroup", this.taskParameters.resourceGroupName));
                armClient.resourceGroups.deleteMethod(this.taskParameters.resourceGroupName, (error, result, request, response) => {
                    if (error) {
                        return reject(tl.loc("CouldNotDeletedResourceGroup", this.taskParameters.resourceGroupName, utils.getError(error)));
                    }
                    console.log(tl.loc("DeletedResourceGroup", this.taskParameters.resourceGroupName));
                    resolve();
                });
            }
            extDelPromise.then(deleteRG, deleteRG);
        });
    }

    public async selectResourceGroup(): Promise<void> {
        if (!utils.isNonEmpty(this.taskParameters.outputVariable) &&
            (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqNone ||
                this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM)) {
            throw tl.loc("OutputVariableShouldNotBeEmpty");
        }

        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        await this.enableDeploymentPrerequestiesIfRequired(armClient);
        await this.registerEnvironmentIfRequired(armClient);
    }

    private writeDeploymentErrors(error) {
        console.log(tl.loc("ErrorsInYourDeployment", error.code));
        if (error.message) {
            tl.error(error.message);
            if (error.details) {
                tl.error(tl.loc("Details"));
                for (var i = 0; i < error.details.length; i++) {
                    var errorMessage = util.format("%s: %s %s", error.details[i].code, error.details[i].message, error.details[i].details);
                    tl.error(errorMessage);
                }
            }
        } else {
            tl.error(error);
        }
    }

    private async registerEnvironmentIfRequired(armClient: armResource.ResourceManagementClient) {
        if (utils.isNonEmpty(this.taskParameters.outputVariable) &&
            (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM ||
                this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqNone)) {
            await this.environmentHelper.RegisterEnvironment();
        }

    }

    private async enableDeploymentPrerequestiesIfRequired(armClient) {
        if (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM) {
            await this.winRMExtensionHelper.ConfigureWinRMExtension();
        }
        else if (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqDG) {
            await this.deploymentGroupExtensionHelper.addExtensionOnResourceGroup();
        }
    }

    private async createResourceGroupIfRequired(armClient: armResource.ResourceManagementClient) {
        var exists = await this.checkResourceGroupExistence(armClient)
        if (!exists) {
            await this.createResourceGroup(armClient);
        }
    }

    private checkResourceGroupExistence(armClient: armResource.ResourceManagementClient): Promise<boolean> {
        console.log(tl.loc("CheckResourceGroupExistence", this.taskParameters.resourceGroupName));
        return new Promise<boolean>((resolve, reject) => {
            armClient.resourceGroups.checkExistence(this.taskParameters.resourceGroupName, (error, exists, request, response) => {
                if (error) {
                    return reject(tl.loc("ResourceGroupStatusFetchFailed", utils.getError(error)));
                }
                console.log(tl.loc("ResourceGroupStatus", exists));
                resolve(exists);
            });
        });
    }

    private createDeploymentName(): string {
        var name: string;
        if (this.taskParameters.templateLocation == "Linked artifact") {
            name = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.taskParameters.csmFile)[0];
        } else {
            name = this.taskParameters.csmFileLink;
        }
        name = path.basename(name).split(".")[0].replace(" ", "");
        var ts = new Date(Date.now());
        var depName = util.format("%s-%s%s%s-%s%s", name, ts.getFullYear(), ts.getMonth(), ts.getDate(), ts.getHours(), ts.getMinutes());
        return depName;
    }

    private castToType(value: string, type: string) {
        switch (type) {
            case "int":
                return parseInt(value);
            case "object":
                return JSON.parse(value);
            case "secureObject":
                return JSON.parse(value);
            case "array":
                return JSON.parse(value);
            case "bool":
                return value === "true";
            default:
                // Sending as string
                break;
        }
        return value;
    }

    private updateOverrideParameters(template: Object, parameters: Object): Object {
        tl.debug("Overriding Parameters..");

        var overrideParameters = parameterParser(this.taskParameters.overrideParameters);
        for (var key in overrideParameters) {
            tl.debug("Overriding key: " + key);
            try {
                overrideParameters[key]["value"] = this.castToType(overrideParameters[key]["value"], template["parameters"][key]["type"]);
            } catch (error) {
                tl.debug(tl.loc("ErrorWhileParsingParameter", key, error.toString()));
            }
            parameters[key] = overrideParameters[key];

        }
        return parameters;
    }

    private createResourceGroup(armClient: armResource.ResourceManagementClient): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("CreatingNewRG", this.taskParameters.resourceGroupName));
            armClient.resourceGroups.createOrUpdate(this.taskParameters.resourceGroupName, { "name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location }, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("ResourceGroupCreationFailed", utils.getError(error)));
                }
                console.log(tl.loc("CreatedRG"));
                resolve();
            });
        });
    }

    private downloadFile(url): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            httpObj.get("GET", url, {}, (error, result, contents) => {
                if (error) {
                    return reject(tl.loc("FileFetchFailed", url, error));
                }
                if (result.statusCode === 200)
                    resolve(contents);
                else {
                    var errorMessage = result.statusCode.toString() + ": " + result.statusMessage;
                    return reject(tl.loc("FileFetchFailed", url, errorMessage));
                }
            });
        });
    }

    private getDeploymentDataForLinkedArtifact(): Deployment {
        var template: Object;
        var fileMatches = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.taskParameters.csmFile);
        if (fileMatches.length > 1) {
            throw new Error(tl.loc("TemplateFilePatternMatchingMoreThanOneFile", fileMatches));
        }
        if (fileMatches.length < 1) {
            throw new Error(tl.loc("TemplateFilePatternMatchingNoFile"));
        }
        var csmFilePath = fileMatches[0];
        if (!fs.lstatSync(csmFilePath).isDirectory()) {
            tl.debug("Loading CSM Template File.. " + csmFilePath);
            try {
                template = JSON.parse(stripJsonComments(fileEncoding.readFileContentsAsText(csmFilePath)));
            }
            catch (error) {
                throw new Error(tl.loc("TemplateParsingFailed", csmFilePath, utils.getError(error.message)));
            }
            tl.debug("Loaded CSM File");
        } else {
            throw new Error(tl.loc("CsmFilePatternMatchesADirectoryInsteadOfAFile", csmFilePath));
        }

        var parameters = {};
        if (utils.isNonEmpty(this.taskParameters.csmParametersFile)) {
            var fileMatches = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.taskParameters.csmParametersFile);
            if (fileMatches.length > 1) {
                throw new Error(tl.loc("TemplateParameterFilePatternMatchingMoreThanOneFile", fileMatches));
            }
            if (fileMatches.length < 1) {
                throw new Error(tl.loc("TemplateParameterFilePatternMatchingNoFile"));
            }
            var csmParametersFilePath = fileMatches[0];
            if (!fs.lstatSync(csmParametersFilePath).isDirectory()) {
                tl.debug("Loading Parameters File.. " + csmParametersFilePath);
                try {
                    var parameterFile = JSON.parse(stripJsonComments(fileEncoding.readFileContentsAsText(csmParametersFilePath)));
                    tl.debug("Loaded Parameters File");
                    parameters = parameterFile["parameters"];
                } catch (error) {
                    throw new Error(tl.loc("ParametersFileParsingFailed", csmParametersFilePath, utils.getError(error.message)));
                }
            } else {
                if (tl.filePathSupplied("csmParametersFile")) {
                    throw new Error(tl.loc("ParametersPatternMatchesADirectoryInsteadOfAFile", csmParametersFilePath));
                }
            }
        }

        if (utils.isNonEmpty(this.taskParameters.overrideParameters)) {
            parameters = this.updateOverrideParameters(template, parameters);
        }

        var deployment = new Deployment({
            template: template,
            parameters: parameters
        });
        deployment.updateCommonProperties(this.taskParameters.deploymentMode);
        return deployment;
    }

    private async getDeploymentObjectForPublicURL(): Promise<Deployment> {
        var properties = {};
        properties["templateLink"] = {
            uri: this.taskParameters.csmFileLink
        };
        var parameters = {};
        var deployment = new Deployment(properties);

        if (utils.isNonEmpty(this.taskParameters.csmParametersFileLink)) {
            if (utils.isNonEmpty(this.taskParameters.overrideParameters)) {
                var contents = await this.downloadFile(this.taskParameters.csmParametersFileLink);
                parameters = JSON.parse(stripJsonComments(contents)).parameters;
            }
            else {
                deployment.properties["parametersLink"] = {
                    uri: this.taskParameters.csmParametersFileLink
                };
            }
        }

        if (utils.isNonEmpty(this.taskParameters.overrideParameters)) {
            tl.debug("Downloading CSM Template File.. " + this.taskParameters.csmFileLink);
            var templateFile = await this.downloadFile(this.taskParameters.csmFileLink);
            var template;
            try {
                var template = JSON.parse(stripJsonComments(templateFile));
                tl.debug("Loaded CSM File");
            }
            catch (error) {
                throw new Error(tl.loc("TemplateParsingFailed", utils.getError(error.message)));
            }
            parameters = this.updateOverrideParameters(template, parameters);
            deployment.properties["parameters"] = parameters;
        }

        deployment.updateCommonProperties(this.taskParameters.deploymentMode);
        return deployment;
    }

    private validateDeployment(armClient: armResource.ResourceManagementClient, deployment: Deployment): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("StartingValidation"));
            deployment.properties["mode"] = "Incremental";
            armClient.deployments.validate(this.taskParameters.resourceGroupName, this.createDeploymentName(), deployment, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("CreateTemplateDeploymentValidationFailed", utils.getError(error)));
                }
                if (result.error) {
                    this.writeDeploymentErrors(result.error);
                    return reject(tl.loc("CreateTemplateDeploymentFailed"));
                } else {
                    console.log(tl.loc("ValidDeployment"));
                    resolve();
                }
            });
        });
    }

    private async performAzureDeployment(armClient: armResource.ResourceManagementClient, deployment: Deployment): Promise<void> {
        if (deployment.properties["mode"] === "Validation") {
            return this.validateDeployment(armClient, deployment);
        } else {
            console.log(tl.loc("StartingDeployment"));
            return new Promise<void>((resolve, reject) => {
                armClient.deployments.createOrUpdate(this.taskParameters.resourceGroupName, this.createDeploymentName(), deployment, (error, result, request, response) => {
                    if (error) {
                        this.writeDeploymentErrors(error);
                        return reject(tl.loc("CreateTemplateDeploymentFailed"));
                    }
                    // if (result && result["properties"] && result["properties"]["outputs"]) {
                    //     tl.command("task.setvariable", { "isOutput": "true", "variable": "DeploymentOutputs" }, JSON.stringify(result["properties"]["outputs"]));
                    //     console.log(tl.loc("AddedOutputVariable"));
                    // }
                    console.log(tl.loc("CreateTemplateDeploymentSucceeded"));
                    resolve();
                });
            });
        }
    }

    private async createTemplateDeployment(armClient: armResource.ResourceManagementClient) {
        console.log(tl.loc("CreatingTemplateDeployment"));
        var deployment: Deployment;
        if (this.taskParameters.templateLocation === "Linked artifact") {
            deployment = this.getDeploymentDataForLinkedArtifact();
        } else if (this.taskParameters.templateLocation === "URL of the file") {
            deployment = await this.getDeploymentObjectForPublicURL();
        } else {
            throw new Error(tl.loc("InvalidTemplateLocation"));
        }
        await this.performAzureDeployment(armClient, deployment);
    }

    private enablePrereqDG = "ConfigureVMWithDGAgent";
    private enablePrereqWinRM = "ConfigureVMwithWinRM";
    private enablePrereqNone = "None";
}
