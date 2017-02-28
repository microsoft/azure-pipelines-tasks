"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "vsts-task-lib/task";
import packerHost from "../packerHost";

export function run(packerHost: packerHost): Q.Promise<any> {
    var command = packerHost.createCommand();
    command.arg("validate");

    // add all variables
    var variables: Map<string, string> = packerHost.templateManager.getTemplateVariables();
    variables.forEach((value: string, key: string) => {
        command.arg(["-var", util.format("%s=%s", key, value)]);
    })
    
    command.arg(packerHost.templateManager.getTemplateFileLocation());

    return packerHost.execCommand(command);
}