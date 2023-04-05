import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import util = require("util");

import env = require("./Environment");
import deployAzureRG = require("../models/DeployAzureRG");
import armResource = require("azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-resource");
import winRM = require("./WinRMExtensionHelper");
import dgExtensionHelper = require("./DeploymentGroupExtensionHelper");
import { PowerShellParameters, NameValuePair } from "./ParameterParser";
import utils = require("./Utils");
import fileEncoding = require('./FileEncoding');
import { ParametersFileObject, TemplateObject, ParameterValue } from "../models/Types";
import httpInterfaces = require("typed-rest-client/Interfaces");
import { sleepFor } from 'azure-pipelines-tasks-azure-arm-rest-v2/webClient';
import azureGraph = require("azure-pipelines-tasks-azure-arm-rest-v2/azure-graph");

var hm = require("typed-rest-client/HttpClient");
var uuid = require("uuid");

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

let httpClient = new hm.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, requestOptions);

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

function formatNumber(num: number): string {
    return ("0" + num).slice(-2);
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
    private _spnName: string;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.winRMExtensionHelper = new winRM.WinRMExtensionHelper(this.taskParameters);
        this.deploymentGroupExtensionHelper = new dgExtensionHelper.DeploymentGroupExtensionHelper(this.taskParameters);
        this.environmentHelper = new env.EnvironmentHelper(this.taskParameters);
	this._spnName = null;
    }

    public async createOrUpdateResourceGroup(): Promise<void> {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.resourceGroupName, this.taskParameters.subscriptionId);
        await this.createResourceGroupIfRequired(armClient);
        await this.createTemplateDeployment(armClient);
        await this.enableDeploymentPrerequestiesIfRequired(armClient);
        await this.registerEnvironmentIfRequired(armClient);
    }

    public deleteResourceGroup(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            var extDelPromise = this.deploymentGroupExtensionHelper.deleteExtensionFromResourceGroup();
            var deleteRG = (val) => {
                var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.resourceGroupName, this.taskParameters.subscriptionId);
                console.log(tl.loc("DeletingResourceGroup", this.taskParameters.resourceGroupName));
                armClient.resourceGroup.deleteMethod((error, result, request, response) => {
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

        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.resourceGroupName, this.taskParameters.subscriptionId);
        await this.enableDeploymentPrerequestiesIfRequired(armClient);
        await this.registerEnvironmentIfRequired(armClient);
    }

    private writeDeploymentErrors(error): void {
        console.log(tl.loc("ErrorsInYourDeployment", error.code));
        if (error.message) {
            tl.error(error.message);
            if (error.details) {
                tl.error(tl.loc("Details"));


                for (var i = 0; i < error.details.length; i++) {
                    var errorMessage = null;
                    let policyLink = null;

                    if (error.details[i].code === "RequestDisallowedByPolicy") {
                        policyLink = this.getPolicyHelpLink(error.details[i]);
                        errorMessage = this.getPolicyErrorMessage(error.details[i]);
                    } else {
                        errorMessage = util.format("%s: %s", error.details[i].code, error.details[i].message);
                        if(error.details[i].details) {
                            if(typeof error.details[i].details == 'object') {
                                errorMessage += " " + JSON.stringify(error.details[i].details);
                            } else {
                                errorMessage += " " + String(error.details[i].details);
                            }
                        }
                    }

                    tl.error(errorMessage);
                    if (policyLink) {
                        tl.error(util.format("[%s](%s)", tl.loc("MoreInformationOnAzurePortal"), policyLink));
                    }
                }


            }
        } else {
            tl.error(error);
        }
    }

    private getPolicyHelpLink(errorDetail) {
        var additionalInfo = errorDetail.additionalInfo;
        if (!!additionalInfo) {
            for (var i = 0; i < additionalInfo.length; i++) {
                if (!!additionalInfo[i].info && !!additionalInfo[i].info.policyAssignmentId) {
                    let portalUrl = this.taskParameters.endpointPortalUrl ? this.taskParameters.endpointPortalUrl : "https://portal.azure.com";
                    return portalUrl + "#blade/Microsoft_Azure_Policy/EditAssignmentBlade/id/" + encodeURIComponent(additionalInfo[i].info.policyAssignmentId);
                }
            }
        }

        return null;
    }

    private getPolicyErrorMessage(errorDetail): string {
        var errorMessage = errorDetail.message;

        if (!!errorMessage) {
            errorMessage = errorMessage.split(".")[0] + ".";
        }

        var additionalInfo = errorDetail.additionalInfo;
        if (!!additionalInfo) {
            for (var i = 0; i < additionalInfo.length; i++) {
                if (!!additionalInfo[i].info) {
                    errorMessage = util.format("%s %s %s, %s %s, %s %s.", errorMessage, tl.loc("ErrorType"), additionalInfo[i].type, tl.loc("PolicyDefinitionName"), additionalInfo[i].info.policyDefinitionDisplayName, tl.loc("PolicyAssignmentName"), additionalInfo[i].info.policyAssignmentName);
                }
            }
        }

        return errorMessage;
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
            armClient.resourceGroup.checkExistence((error, exists, request, response) => {
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
            name = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.escapeBlockCharacters(this.taskParameters.csmFile))[0];
        } else {
            name = this.taskParameters.csmFileLink;
        }
        name = path.basename(name).split(".")[0].replace(/\s/g, "");
        name = name.substr(0, 40);
        var timestamp = new Date(Date.now());
        var uniqueId = uuid().substr(0, 4);
        var suffix = util.format("%s%s%s-%s%s%s-%s", timestamp.getFullYear(),
            formatNumber(timestamp.getMonth() + 1),
            formatNumber(timestamp.getDate()),
            formatNumber(timestamp.getHours()),
            formatNumber(timestamp.getMinutes()),
            formatNumber(timestamp.getSeconds()),
            uniqueId);
        var deploymentName = util.format("%s-%s", name, suffix);
        if (deploymentName.match(/^[-\w\._\(\)]+$/) === null) {
            deploymentName = util.format("deployment-%s", suffix);
        }
        return deploymentName;
    }

    private castToType(value: string, type: string): any {
        switch (type.toLowerCase()) {
            case "int":
            case "object":
            case "secureobject":
            case "array":
            case "bool":
                return JSON.parse(value);
            case "string":
            case "securestring":
                return JSON.parse(`"` + value + `"`); // Adding trailing quotes for JSON parser to detect string
            default:
                // Sending as string
                break;
        }
        return value;
    }

    private updateOverrideParameters(template: TemplateObject, parameters: Map<string, ParameterValue>): Map<string, ParameterValue> {
        tl.debug("Overriding Parameters..");

        var overrideParameters: NameValuePair[] = PowerShellParameters.parse(this.taskParameters.overrideParameters, true, "\\");
        for (var overrideParameter of overrideParameters) {
            tl.debug("Overriding key: " + overrideParameter.name);
            if (this.taskParameters.addSpnToEnvironment) {
                if (overrideParameter.value === "$servicePrincipalId") {
                    overrideParameter.value = tl.getEndpointAuthorizationParameter(this.taskParameters.connectedService, 'serviceprincipalid', true);
                }
                if (overrideParameter.value === "$servicePrincipalKey") {
                    overrideParameter.value = tl.getEndpointAuthorizationParameter(this.taskParameters.connectedService, 'serviceprincipalkey', false);
                }
            }

            try {
                overrideParameter.value = this.castToType(overrideParameter.value, template.parameters[overrideParameter.name].type);
            } catch (error) {
                console.log(tl.loc("ErrorWhileParsingParameter", overrideParameter.name, error.toString()));
            }
            parameters[overrideParameter.name] = {
                value: overrideParameter.value
            } as ParameterValue;
        }
        return parameters;
    }

    private createResourceGroup(armClient: armResource.ResourceManagementClient): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("CreatingNewRG", this.taskParameters.resourceGroupName));
            armClient.resourceGroup.createOrUpdate({ "name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location }, (error, result, request, response) => {
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
            httpClient.get(url, {}).then(async (response) => {
                if (response.message.statusCode == 200) {
                    let contents: string = "";
                    try {
                        contents = await response.readBody();
                        contents = contents.replace(/^\uFEFF/, ''); // Remove UTF-8 BOM if present.
                    } catch (error) {
                        reject(tl.loc("UnableToReadResponseBody", error));
                    }
                    resolve(contents);
                } else {
                    var errorMessage = response.message.statusCode.toString() + ": " + response.message.statusMessage;
                    return reject(tl.loc("FileFetchFailed", url, errorMessage));
                }
            }, (error) => {
                return reject(tl.loc("FileFetchFailed", url, error));
            });
        });
    }

    private getDeploymentDataForLinkedArtifact(): Deployment {
        var template: TemplateObject;
        var fileMatches = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.escapeBlockCharacters(this.taskParameters.csmFile));
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

        var parameters: Map<string, ParameterValue> = {} as Map<string, ParameterValue>;
        if (utils.isNonEmpty(this.taskParameters.csmParametersFile)) {
            var fileMatches = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.escapeBlockCharacters(this.taskParameters.csmParametersFile));
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
                    parameters = parameterFile["parameters"] as Map<string, ParameterValue>;
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

        parameters = this.sanitizeParameters(parameters);

        var deployment = new Deployment({
            template: template,
            parameters: parameters
        });
        deployment.updateCommonProperties(this.taskParameters.deploymentMode);
        return deployment;
    }

    private sanitizeParameters(parameters: Map<string, ParameterValue>): Map<string, ParameterValue> {
        var result: Map<string, ParameterValue> = {} as Map<string, ParameterValue>;
        for (var key in parameters) {
            if (!!parameters[key]) {
                if (parameters[key].hasOwnProperty("value")) {
                    result[key] = {
                        value: parameters[key].value
                    } as ParameterValue;
                } else if (parameters[key].hasOwnProperty("reference")) {
                    result[key] = {
                        reference: parameters[key].reference
                    } as ParameterValue;
                }
            }
        }

        return result;
    }

    private async getDeploymentObjectForPublicURL(): Promise<Deployment> {
        var properties = {};
        properties["templateLink"] = {
            uri: this.taskParameters.csmFileLink
        };
        var parameters: Map<string, ParameterValue> = {} as Map<string, ParameterValue>;
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
            parameters = this.sanitizeParameters(parameters);
            deployment.properties["parameters"] = parameters;
        }

        deployment.updateCommonProperties(this.taskParameters.deploymentMode);
        return deployment;
    }

    private validateDeployment(armClient: armResource.ResourceManagementClient, deployment: Deployment): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("StartingValidation"));
            if(!(!!deployment.properties["mode"] && (deployment.properties["mode"] === "Complete" || deployment.properties["mode"] === "Incremental")))
            {
                deployment.properties["mode"] = "Incremental";
            }
            this.taskParameters.deploymentName = this.taskParameters.deploymentName || this.createDeploymentName();
            console.log(tl.loc("LogDeploymentName", this.taskParameters.deploymentName));
            armClient.deployments.validate(this.taskParameters.deploymentName, deployment, (error, result, request, response) => {
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

    private async performAzureDeployment(armClient: armResource.ResourceManagementClient, deployment: Deployment, retryCount = 0): Promise<void> {
        if(!this._spnName && this.taskParameters.authScheme == "ServicePrincipal") {
            this._spnName = await this.getServicePrincipalName();
        }

        if (deployment.properties["mode"] === "Validation") {
            deployment.properties["mode"] = "Incremental";
            return this.validateDeployment(armClient, deployment);
        } else {
            try {
                await this.validateDeployment(armClient, deployment);
            } catch (error) {
                tl.warning(tl.loc("TemplateValidationFailure", error));
            }
            console.log(tl.loc("StartingDeployment"));
            return new Promise<void>((resolve, reject) => {
                this.taskParameters.deploymentName = this.taskParameters.deploymentName || this.createDeploymentName();
                console.log(tl.loc("LogDeploymentName", this.taskParameters.deploymentName));
                armClient.deployments.createOrUpdate(this.taskParameters.deploymentName, deployment, (error, result, request, response) => {
                    if (error) {
                        if(error.code == "ResourceGroupNotFound" && retryCount > 0){
                            return this.waitAndPerformAzureDeployment(armClient, deployment, retryCount);
                        }
                        this.writeDeploymentErrors(error);
                        this.checkAndPrintPortalDeploymentURL((!!result && !!result.error) ? result.error : error);    
                        this.printServicePrincipalRoleAssignmentError(error);
                        return reject(tl.loc("CreateTemplateDeploymentFailed"));
                    }
                    if (result && result["properties"] && result["properties"]["outputs"] && utils.isNonEmpty(this.taskParameters.deploymentOutputs)) {
                        const setVariablesInObject = (path: string, obj: any) => {
                            for (var key of Object.keys(obj)) {
                                if (obj[key] && typeof(obj[key]) === "object") {
                                    setVariablesInObject(`${path}.${key}`, obj[key]);
                                }
                                else {
                                    console.log(`##vso[task.setvariable variable=${path}.${key};]` + JSON.stringify(obj[key]));
                                    console.log(tl.loc("AddedOutputVariable", `${path}.${key}`));
                                }
                            }
                        }
                        if (typeof(result["properties"]["outputs"]) === "object") {
                            setVariablesInObject(this.taskParameters.deploymentOutputs, result["properties"]["outputs"]);
                        }
                        console.log(`##vso[task.setvariable variable=${this.taskParameters.deploymentOutputs};]` + JSON.stringify(result["properties"]["outputs"]));
                        console.log(tl.loc("AddedOutputVariable", this.taskParameters.deploymentOutputs));
                    }

                    console.log(tl.loc("CreateTemplateDeploymentSucceeded"));
                    resolve();
                });
            });
        }
    }

    private printServicePrincipalRoleAssignmentError(error: any) {
        if(!!error && error.statusCode == 403) {
            if(this.taskParameters.authScheme == "ServicePrincipal") {
                tl.error(tl.loc("ServicePrincipalRoleAssignmentDetails", this._spnName, this.taskParameters.resourceGroupName));
            } else if(this.taskParameters.authScheme == "ManagedServiceIdentity") {
                tl.error(tl.loc("ManagedServiceIdentityDetails", this.taskParameters.resourceGroupName));    
            }
        }
    }

    protected async getServicePrincipalName(): Promise<string> {
        try {
            var graphClient: azureGraph.GraphManagementClient = new azureGraph.GraphManagementClient(this.taskParameters.graphCredentials);
            var servicePrincipalObject = await graphClient.servicePrincipals.GetServicePrincipal(null);
            return !!servicePrincipalObject ? servicePrincipalObject.appDisplayName : "";    
        } catch (error) {
            tl.debug(tl.loc("ServicePrincipalFetchFailed", error));
            return "";
        }
    }

    protected checkAndPrintPortalDeploymentURL(error: any) {
        if(!!error && (error.statusCode < 400 || error.statusCode >= 500)) {
            let url = this.getAzurePortalDeploymentURL();
            if(url != null) {
                tl.error(tl.loc("FindMoreDeploymentDetailsAzurePortal", this.getAzurePortalDeploymentURL()));    
            }
        }
    }

    private getAzurePortalDeploymentURL() {
        try {
            let portalUrl = this.taskParameters.endpointPortalUrl ? this.taskParameters.endpointPortalUrl : "https://portal.azure.com";
            portalUrl += "/#blade/HubsExtension/DeploymentDetailsBlade/overview/id/";
            let subscriptionSpecificURL = "/subscriptions/" + this.taskParameters.subscriptionId + "/resourceGroups/" + this.taskParameters.resourceGroupName + "/providers/Microsoft.Resources/deployments/" + this.taskParameters.deploymentName;
            return portalUrl + subscriptionSpecificURL.replace(/\//g, '%2F');
        } catch (error) {
            tl.error(error);
            return null;
        }
    }

    private async waitAndPerformAzureDeployment(armClient: armResource.ResourceManagementClient, deployment: Deployment, retryCount): Promise<void> {
        await sleepFor(3);
        return this.performAzureDeployment(armClient, deployment, retryCount - 1);
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
        await this.performAzureDeployment(armClient, deployment, 3);
    }

    private escapeBlockCharacters(str: string): string {
        return str.replace(/[\[]/g, '$&[]');
    }

    private enablePrereqDG = "ConfigureVMWithDGAgent";
    private enablePrereqWinRM = "ConfigureVMwithWinRM";
    private enablePrereqNone = "None";
}
