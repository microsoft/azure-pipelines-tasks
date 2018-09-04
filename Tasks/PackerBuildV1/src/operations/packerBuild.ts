"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "vsts-task-lib/task";
import packerHost from "../packerHost";
import OutputVariablesParser from "../outputParsers"
import * as constants from "../constants"
import * as definitions from "../definitions"
import * as utils from "../utilities"

export async function run(packerHost: packerHost): Promise<any> {
    var command = packerHost.createPackerTool();
    command.arg("build");
    command.arg("-force");
    command.arg("-color=false");

    // add all variables
    var variableProviders = packerHost.getTemplateVariablesProviders();
    for (var provider of variableProviders) {
        var variables = await provider.getTemplateVariables(packerHost);
        let filePath: string = utils.generateTemporaryFilePath();
        let content: string = utils.getPackerVarFileContent(variables);
        utils.writeFile(filePath, content);
        command.arg(util.format("%s=%s", '-var-file', filePath));
    }

    command.arg(packerHost.getTemplateFileProvider().getTemplateFileLocation(packerHost));

    console.log(tl.loc("ExecutingPackerBuild"));
    var taskParameters = packerHost.getTaskParameters();
    var outputVariablesParser: definitions.IOutputParser;
    if (taskParameters.templateType === constants.TemplateTypeCustom) {
        outputVariablesParser = new OutputVariablesParser([constants.PackerLogTokenImageUri, constants.PackerLogTokenStorageLocation, constants.PackerLogTokenManagedImageName, constants.PackerLogTokenManagedResourceGroupName, constants.PackerLogTokenManagedImageLocation]);
    }
    else {
        if (!taskParameters.isManagedImage) {
            outputVariablesParser = new OutputVariablesParser([constants.PackerLogTokenImageUri, constants.PackerLogTokenStorageLocation]);
        } else {
            outputVariablesParser = new OutputVariablesParser([constants.PackerLogTokenManagedImageName, constants.PackerLogTokenManagedResourceGroupName, constants.PackerLogTokenManagedImageLocation]);
        }
    }

    await packerHost.execTool(command, outputVariablesParser);

    // set output task variables
    setOutputVariables(packerHost, outputVariablesParser.getExtractedOutputs());
}

function setOutputVariables(packerHost: packerHost, outputs: Map<string, string>): void {
    var taskParameters = packerHost.getTaskParameters();
    var imageUri;
    var managedImageName;

    if (!utils.IsNullOrEmpty(taskParameters.imageUri)) {
        if (taskParameters.templateType === constants.TemplateTypeBuiltin) {
            if (!taskParameters.isManagedImage) {
                imageUri = outputs.get(constants.PackerLogTokenImageUri);
                if (!utils.IsNullOrEmpty(imageUri)) {
                    tl.debug("Setting image URI variable to: " + imageUri);
                    tl.setVariable(taskParameters.imageUri, imageUri);
                } else {
                    throw tl.loc("ImageURIOutputVariableNotFound");
                }
            } else {
                imageUri = outputs.get(constants.PackerLogTokenManagedImageName);
                if (!utils.IsNullOrEmpty(imageUri)) {
                    tl.debug("Setting image URI variable which contains the managed image name to: " + imageUri);
                    tl.setVariable(taskParameters.imageUri, imageUri);
                } else {
                    throw tl.loc("ManagedImageNameOutputVariableNotFound");
                }
            }
        } else {
            imageUri = outputs.get(constants.PackerLogTokenImageUri);
            managedImageName = outputs.get(constants.PackerLogTokenManagedImageName);

            if (!utils.IsNullOrEmpty(managedImageName)) {
                tl.debug("Setting image URI variable which contains the managed image name to: " + managedImageName);
                tl.setVariable(taskParameters.imageUri, managedImageName);
            }
            else if (!utils.IsNullOrEmpty(imageUri)) {
                tl.debug("Setting image URI variable to: " + imageUri);
                tl.setVariable(taskParameters.imageUri, imageUri);
            }
            else {
                throw tl.loc("CustumTemplateOutputVariableNotFound");
            }
        }
    }
}