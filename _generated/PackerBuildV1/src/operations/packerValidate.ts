"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "azure-pipelines-task-lib/task";
import packerHost from "../packerHost";
import * as utils from "../utilities"

export async function run(packerHost: packerHost): Promise<void> {
    var command = packerHost.createPackerTool();
    command.arg("validate");

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

    console.log(tl.loc("ExecutingPackerValidate"));
    var result = command.execSync();

    if(result.code != 0) {
        throw tl.loc("PackerValidateFailed");
    }
}