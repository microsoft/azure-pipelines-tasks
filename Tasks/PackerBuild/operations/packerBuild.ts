"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "vsts-task-lib/task";
import packerHost from "../packerHost";
import * as op from "../outputParsers"

export function run(packerHost: packerHost): Q.Promise<any> {
    var command = packerHost.createCommand();
    command.arg("build");
    command.arg("-force");

    // add all variables
    var variables: Map<string, string> = packerHost.templateManager.getTemplateVariables();
    variables.forEach((value: string, key: string) => {
        command.arg(["-var", util.format("%s=%s", key, value)]);
    })
    
    command.arg(packerHost.templateManager.getTemplateFileLocation());

    console.log(tl.loc("ExecutingPackerBuild"));
    var outputExtractor: op.OutputVariablesExtractor = new op.OutputVariablesExtractor(["OSDiskUri", "StorageAccountLocation"]);
    return packerHost.execCommand(command, null, outputExtractor);
}