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

    // add all variables
    var variableProviders = packerHost.getTemplateVariablesProviders(); 
    variableProviders.forEach((provider) => {
        var variables = provider.getTemplateVariables(packerHost);
        variables.forEach((value: string, key: string) => {
            command.arg(["-var", util.format("%s=%s", key, value)]);
        });
    });
    
    command.arg(packerHost.getTemplateFileProvider().getTemplateFileLocation(packerHost));

    console.log(tl.loc("ExecutingPackerBuild"));
    var outputVariablesParser: definitions.IOutputParser = new OutputVariablesParser([constants.PackerLogTokenImageUri, constants.PackerLogTokenStorageLocation]);
    await packerHost.execTool(command, outputVariablesParser);

    // set output task variables
    setOutputVariables(outputVariablesParser.getExtractedOutputs());
}

function setOutputVariables(outputs: Map<string, string>): void {
    var imageUri = outputs.get(constants.PackerLogTokenImageUri);
    var imageStorageAccount = outputs.get(constants.PackerLogTokenStorageLocation);

    if(!utils.IsNullOrEmpty(tl.getInput(constants.OutputVariableImageUri, false))) {
        if(!utils.IsNullOrEmpty(imageUri)) {
            tl.debug("Setting image URI variable to: " + imageUri);
            tl.setVariable(tl.getInput(constants.OutputVariableImageUri, false), imageUri);
        } else {
            throw tl.loc("ImageURIOutputVariableNotFound");
        }
    }

    if(!utils.IsNullOrEmpty(tl.getInput(constants.OutputVariableImageStorageAccountLocation, false))) {
        if(!utils.IsNullOrEmpty(imageStorageAccount)) {
            tl.debug("Setting image storage location variable to: " + imageStorageAccount);
            tl.setVariable(tl.getInput(constants.OutputVariableImageStorageAccountLocation, false), imageStorageAccount);
        } else {
            throw tl.loc("StorageAccountLocationOutputVariableNotFound");
        }
    }
}