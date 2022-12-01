import util = require("util");
import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");

import armDeployTaskParameters = require("../models/TaskParameters");
import { PowerShellParameters, NameValuePair } from "./ParameterParser";
import fileEncoding = require('./FileEncoding');
import { TemplateObject, ParameterValue } from "../models/Types";
import httpInterfaces = require("typed-rest-client/Interfaces");
import { DeploymentParameters } from "./DeploymentParameters";

var cpExec = util.promisify(require('child_process').exec);
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

function formatNumber(num: number): string {
    return ("0" + num).slice(-2);
}

class Utils {
    public static cleanupFileList = []

    public static isNonEmpty(str: string): boolean {
        return (!!str && !!str.trim());
    }

    public static getError(error: any): string {
        if (error && error.message) {
            return JSON.stringify(error.message);
        }

        if (typeof error === "string") {
            return error;
        }

        return JSON.stringify(error);
    }

    public static buildErrorString(errors: string[]): string {
        let index: number = 1;
        return errors.map(error => !!error ? util.format("%s. %s \n", index++, error) : "").join("");
    }

    public static stripJsonComments(content) {
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

    public static writeDeploymentErrors(taskParameters: armDeployTaskParameters.TaskParameters, error): void {
        console.log(tl.loc("ErrorsInYourDeployment", error.code));
        if (error.message) {
            tl.error(error.message);
            if (error.details) {
                tl.error(tl.loc("Details"));


                for (var i = 0; i < error.details.length; i++) {
                    var errorMessage = null;
                    let policyLink = null;

                    if (error.details[i].code === "RequestDisallowedByPolicy") {
                        policyLink = this.getPolicyHelpLink(taskParameters, error.details[i]);
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

    public static async getDeploymentObjectForPublicURL(taskParameters: armDeployTaskParameters.TaskParameters): Promise<DeploymentParameters> {
        var properties = {};
        properties["templateLink"] = {
            uri: taskParameters.csmFileLink
        };
        var parameters: Map<string, ParameterValue> = {} as Map<string, ParameterValue>;
        var deploymentParameters = new DeploymentParameters(properties);

        if (this.isNonEmpty(taskParameters.csmParametersFileLink)) {
            if (this.isNonEmpty(taskParameters.overrideParameters)) {
                var contents = await this.downloadFile(taskParameters.csmParametersFileLink);
                parameters = JSON.parse(this.stripJsonComments(contents)).parameters;
            }
            else {
                deploymentParameters.properties["parametersLink"] = {
                    uri: taskParameters.csmParametersFileLink
                };
            }
        }

        if (this.isNonEmpty(taskParameters.overrideParameters)) {
            tl.debug("Downloading CSM Template File.. " + taskParameters.csmFileLink);
            var templateFile = await this.downloadFile(taskParameters.csmFileLink);
            var template;
            try {
                var template = JSON.parse(this.stripJsonComments(templateFile));
                tl.debug("Loaded CSM File");
            }
            catch (error) {
                throw new Error(tl.loc("TemplateParsingFailed", this.getError(error.message)));
            }
            parameters = this.updateOverrideParameters(taskParameters, template, parameters);
            parameters = this.sanitizeParameters(parameters);
            deploymentParameters.properties["parameters"] = parameters;
        }

        deploymentParameters.updateCommonProperties(taskParameters.deploymentMode);
        return deploymentParameters;
    }

    public static createDeploymentName(taskParameters: armDeployTaskParameters.TaskParameters): string {
        var name: string;
        if (taskParameters.templateLocation == "Linked artifact") {
            name = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.escapeBlockCharacters(taskParameters.csmFile))[0];
        } else {
            name = taskParameters.csmFileLink;
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

    public static async getDeploymentDataForLinkedArtifact(taskParameters: armDeployTaskParameters.TaskParameters): Promise<DeploymentParameters> {
        var template: TemplateObject;
        var fileMatches = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.escapeBlockCharacters(taskParameters.csmFile));
        if (fileMatches.length > 1) {
            throw new Error(tl.loc("TemplateFilePatternMatchingMoreThanOneFile", fileMatches));
        }
        if (fileMatches.length < 1) {
            throw new Error(tl.loc("TemplateFilePatternMatchingNoFile"));
        }
        var csmFilePath = fileMatches[0];
        if (!fs.lstatSync(csmFilePath).isDirectory()) {
            tl.debug("Loading CSM Template File.. " + csmFilePath);
            csmFilePath = await this.getFilePathForLinkedArtifact(csmFilePath)
            try {
                template = JSON.parse(this.stripJsonComments(fileEncoding.readFileContentsAsText(csmFilePath)));
            }
            catch (error) {
                throw new Error(tl.loc("TemplateParsingFailed", csmFilePath, this.getError(error.message)));
            }
            tl.debug("Loaded CSM File");
        } else {
            throw new Error(tl.loc("CsmFilePatternMatchesADirectoryInsteadOfAFile", csmFilePath));
        }

        var parameters: Map<string, ParameterValue> = {} as Map<string, ParameterValue>;
        if (this.isNonEmpty(taskParameters.csmParametersFile)) {
            var fileMatches = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.escapeBlockCharacters(taskParameters.csmParametersFile));
            if (fileMatches.length > 1) {
                throw new Error(tl.loc("TemplateParameterFilePatternMatchingMoreThanOneFile", fileMatches));
            }
            if (fileMatches.length < 1) {
                throw new Error(tl.loc("TemplateParameterFilePatternMatchingNoFile"));
            }
            var csmParametersFilePath = fileMatches[0];
            if (!fs.lstatSync(csmParametersFilePath).isDirectory()) {
                tl.debug("Loading Parameters File.. " + csmParametersFilePath);
                csmParametersFilePath = await this.getFilePathForLinkedArtifact(csmParametersFilePath)
                try {
                    var parameterFile = JSON.parse(this.stripJsonComments(fileEncoding.readFileContentsAsText(csmParametersFilePath)));
                    tl.debug("Loaded Parameters File");
                    parameters = parameterFile["parameters"] as Map<string, ParameterValue>;
                } catch (error) {
                    throw new Error(tl.loc("ParametersFileParsingFailed", csmParametersFilePath, this.getError(error.message)));
                }
            } else {
                if (tl.filePathSupplied("csmParametersFile")) {
                    throw new Error(tl.loc("ParametersPatternMatchesADirectoryInsteadOfAFile", csmParametersFilePath));
                }
            }
        }

        if (this.isNonEmpty(taskParameters.overrideParameters)) {
            parameters = this.updateOverrideParameters(taskParameters, template, parameters);
        }

        parameters = this.sanitizeParameters(parameters);

        var deploymentParameters = new DeploymentParameters({
            template: template,
            parameters: parameters
        });
        deploymentParameters.updateCommonProperties(taskParameters.deploymentMode);
        return deploymentParameters;
    }

    public static deleteGeneratedFiles(): void{
        this.cleanupFileList.forEach(filePath => {
            try{
                fs.unlinkSync(filePath);
            }catch(err){
                console.log(tl.loc("BicepFileCleanupFailed", err))
            }
        });
    }

    private static getPolicyHelpLink(taskParameters: armDeployTaskParameters.TaskParameters, errorDetail) {
        var additionalInfo = errorDetail.additionalInfo;
        if (!!additionalInfo) {
            for (var i = 0; i < additionalInfo.length; i++) {
                if (!!additionalInfo[i].info && !!additionalInfo[i].info.policyAssignmentId) {
                    let portalUrl = taskParameters.endpointPortalUrl ? taskParameters.endpointPortalUrl : "https://portal.azure.com";
                    return portalUrl + "#blade/Microsoft_Azure_Policy/EditAssignmentBlade/id/" + encodeURIComponent(additionalInfo[i].info.policyAssignmentId);
                }
            }
        }

        return null;
    }

    private static getPolicyErrorMessage(errorDetail): string {
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

    private static castToType(value: string, type: string): any {
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

    private static updateOverrideParameters(taskParameters: armDeployTaskParameters.TaskParameters, template: TemplateObject, parameters: Map<string, ParameterValue>): Map<string, ParameterValue> {
        tl.debug("Overriding Parameters..");

        var overrideParameters: NameValuePair[] = PowerShellParameters.parse(taskParameters.overrideParameters, true, "\\");
        for (var overrideParameter of overrideParameters) {
            tl.debug("Overriding key: " + overrideParameter.name);
            if (taskParameters.addSpnToEnvironment) {
                if (overrideParameter.value === "$servicePrincipalId") {
                    overrideParameter.value = tl.getEndpointAuthorizationParameter(taskParameters.connectedService, 'serviceprincipalid', true);
                }
                if (overrideParameter.value === "$servicePrincipalKey") {
                    overrideParameter.value = tl.getEndpointAuthorizationParameter(taskParameters.connectedService, 'serviceprincipalkey', false);
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

    private static downloadFile(url): Promise<string> {
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

    private static sanitizeParameters(parameters: Map<string, ParameterValue>): Map<string, ParameterValue> {
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

    private static escapeBlockCharacters(str: string): string {
        return str.replace(/[\[]/g, '$&[]');
    }

    private static async getFilePathForLinkedArtifact(filePath: string): Promise<string> {
        var filePathExtension: string = filePath.split('.').pop();
        if(filePathExtension === 'bicep'){
            let azcliversion = await this.getAzureCliVersion()
            if(parseFloat(azcliversion)){
                if(this.isBicepAvailable(azcliversion)){
                    await this.execBicepBuild(filePath)
                    filePath = filePath.replace('.bicep', '.json')
                    this.cleanupFileList.push(filePath)
                }else{
                    throw new Error(tl.loc("IncompatibleAzureCLIVersion"));
                }
            }else{
                throw new Error(tl.loc("AzureCLINotFound"));
            }
        }
        return filePath
    }

    private static async getAzureCliVersion(): Promise<string> {
        let azcliversion: string = "" ;
        const {error, stdout, stderr } = await cpExec('az version');
        if(error && error.code !== 0){
            throw new Error(tl.loc("FailedToFetchAzureCLIVersion", stderr));
        }else{
            try{
                azcliversion = JSON.parse(stdout)["azure-cli"]
            }catch(err){
                throw new Error(tl.loc("FailedToFetchAzureCLIVersion", err));
            }
        }
        return azcliversion
    }

    private static async execBicepBuild(filePath): Promise<void> {
        const {error, stdout, stderr} = await cpExec(`az bicep build --file ${filePath}`);
        if(error && error.code !== 0){
            throw new Error(tl.loc("BicepBuildFailed", stderr));
        }
    }

    private static isBicepAvailable(azcliversion): Boolean{
        let majorVersion = azcliversion.split('.')[0]
        let minorVersion = azcliversion.split('.')[1]
        // Support Bicep was introduced in az-cli 2.20.0
        if((majorVersion == 2 && minorVersion >= 20) || majorVersion > 2){
            return true
        }
        return false
    }
}

export = Utils;