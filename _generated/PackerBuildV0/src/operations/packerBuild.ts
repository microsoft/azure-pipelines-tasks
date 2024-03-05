"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "azure-pipelines-task-lib/task";
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
    var outputVariablesParser: definitions.IOutputParser = new OutputVariablesParser([constants.PackerLogTokenImageUri, constants.PackerLogTokenStorageLocation]);
    await packerHost.execTool(command, outputVariablesParser);

    // set output task variables
    setOutputVariables(packerHost, outputVariablesParser.getExtractedOutputs());
}

function setOutputVariables(packerHost: packerHost, outputs: Map<string, string>): void {
    var imageUri = outputs.get(constants.PackerLogTokenImageUri);
    var taskParameters = packerHost.getTaskParameters();

    if(!utils.IsNullOrEmpty(taskParameters.imageUri)) {
        if(!utils.IsNullOrEmpty(imageUri)) {
            tl.debug("Setting image URI variable to: " + imageUri);
            tl.setVariable(taskParameters.imageUri, imageUri);
        } else {
            throw tl.loc("ImageURIOutputVariableNotFound");
        }
    }
}