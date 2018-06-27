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
    for (var provider of variableProviders) {
        var variables = await provider.getTemplateVariables(packerHost);
        variables.forEach((value: string, key: string) => {
            command.arg(["-var", util.format("%s=%s", key, value)]);
        });
    }

    command.arg(packerHost.getTemplateFileProvider().getTemplateFileLocation(packerHost));

    console.log(tl.loc("ExecutingPackerBuild"));
    var taskParameters = packerHost.getTaskParameters();
    var outputVariablesParser: definitions.IOutputParser;
    if(!taskParameters.isManagedImage){
        outputVariablesParser = new OutputVariablesParser([constants.PackerLogTokenImageUri, constants.PackerLogTokenStorageLocation]);
    } else {
        outputVariablesParser = new OutputVariablesParser([constants.PackerLogTokenManagedImageName, constants.PackerLogTokenManagedResourceGroupName, constants.PackerLogTokenManagedImageLocation]);
    }

    await packerHost.execTool(command, outputVariablesParser);

    // set output task variables
    setOutputVariables(packerHost, outputVariablesParser.getExtractedOutputs());
}

function setOutputVariables(packerHost: packerHost, outputs: Map<string, string>): void {
   var taskParameters = packerHost.getTaskParameters();
   var imageUri;
   if(!taskParameters.isManagedImage) {
       imageUri = outputs.get(constants.PackerLogTokenImageUri);
   } else {
       imageUri = outputs.get(constants.PackerLogTokenManagedImageName);
   }

    if(!utils.IsNullOrEmpty(taskParameters.imageUri)) {
        if(!utils.IsNullOrEmpty(imageUri)) {
            if(!taskParameters.isManagedImage){
                tl.debug("Setting image URI variable to: " + imageUri);
            } else {
                tl.debug("Setting image URI variable which contains the managed image name to: " + imageUri);
            }
            
            tl.setVariable(taskParameters.imageUri, imageUri);
        } else {
            if(!taskParameters.isManagedImage){
                throw tl.loc("ImageURIOutputVariableNotFound");
            } else {
                throw tl.loc("ManagedImageNameOutputVariableNotFound");
            }
        }
    }
}