"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
    let args = tl.getInput("arguments");
    if (args) {
        tl.warning(tl.loc('IgnoringArgumentsInput'));
    }

    let dockerbuild = require("./dockerbuild");
    let dockerpush = require("./dockerpush");

    let outputPaths = "";
    let promise = dockerbuild.run(connection, (outputPath) => outputPaths += outputPath, true).then(() => {
        return dockerpush.run(connection, (outputPath) => outputPaths += ("\n" + outputPath), true).then(() => {
            outputUpdate(outputPaths);
        });
    })
    
    return promise;
}