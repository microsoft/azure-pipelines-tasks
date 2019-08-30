import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

import serviceClient = require("azure-arm-rest/AzureServiceClient");
import deployAzureRG = require("../models/DeployAzureRG");
import { PowerShellParameters, NameValuePair } from "./ParameterParser";
import utils = require("./Utils");
import fileEncoding = require('./FileEncoding');
import { TemplateObject, ParameterValue } from "../models/Types";
import httpInterfaces = require("typed-rest-client/Interfaces");

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

export class DeploymentScopeClient {
    
    protected taskParameters: deployAzureRG.AzureRGTaskParameters;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
    }

    protected async getTemplateDeployment() {
        console.log(tl.loc("CreatingTemplateDeployment"));
        var deployment: Deployment;
        if (this.taskParameters.templateLocation === "Linked artifact") {
            deployment = this.getDeploymentDataForLinkedArtifact();
        } else if (this.taskParameters.templateLocation === "URL of the file") {
            deployment = await this.getDeploymentObjectForPublicURL();
        } else {
            throw new Error(tl.loc("InvalidTemplateLocation"));
        }
        return deployment;
    }

    protected writeDeploymentErrors(error): void {
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
                        errorMessage = util.format("%s: %s %s", error.details[i].code, error.details[i].message, error.details[i].details);
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

    protected createDeploymentName(): string {
        var name: string;
        if (this.taskParameters.templateLocation == "Linked artifact") {
            name = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.taskParameters.csmFile)[0];
        } else {
            name = this.taskParameters.csmFileLink;
        }
        name = path.basename(name).split(".")[0].replace(" ", "");
        name = name.substr(0, 40);
        var timestamp = new Date(Date.now());
        var uniqueId = uuid().substr(0, 4);
        var suffix = util.format("%s%s%s-%s%s%s-%s", timestamp.getFullYear(),
            utils.formatNumber(timestamp.getMonth() + 1),
            utils.formatNumber(timestamp.getDate()),
            utils.formatNumber(timestamp.getHours()),
            utils.formatNumber(timestamp.getMinutes()),
            utils.formatNumber(timestamp.getSeconds()),
            uniqueId);
        var deploymentName = util.format("%s-%s", name, suffix);
        if (deploymentName.match(/^[-\w\._\(\)]+$/) === null) {
            deploymentName = util.format("deployment-%s", suffix);
        }
        return deploymentName;
    }

    private getDeploymentDataForLinkedArtifact(): Deployment {
        var template: TemplateObject;
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
                template = JSON.parse(utils.stripJsonComments(fileEncoding.readFileContentsAsText(csmFilePath)));
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
                    var parameterFile = JSON.parse(utils.stripJsonComments(fileEncoding.readFileContentsAsText(csmParametersFilePath)));
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
                parameters = JSON.parse(utils.stripJsonComments(contents)).parameters;
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
                var template = JSON.parse(utils.stripJsonComments(templateFile));
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
}

export class Deployment {
    public properties: Object;

    constructor(properties: Object) {
        this.properties = properties;
    }
    public updateCommonProperties(mode: string) {
        this.properties["mode"] = mode;
        this.properties["debugSetting"] = { "detailLevel": "requestContent, responseContent" };
    }
}