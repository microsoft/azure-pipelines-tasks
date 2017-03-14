"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "vsts-task-lib/task";
import packerHost from "../packerHost";

export function run(packerHost: packerHost): void {
    var command = packerHost.createPackerTool();
    command.arg("validate");

    // add all variables
    var variableProviders = packerHost.getTemplateVariablesProviders(); 
    variableProviders.forEach((provider) => {
        var variables = provider.getTemplateVariables(packerHost);
        variables.forEach((value: string, key: string) => {
            command.arg(["-var", util.format("%s=%s", key, value)]);
        });
    });
    
    command.arg(packerHost.getTemplateFileProvider().getTemplateFileLocation(packerHost));

    console.log(tl.loc("ExecutingPackerValidate"));
    var result = command.execSync();

    if(result.code != 0) {
        throw tl.loc("PackerValidateFailed");
    }
}