"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
    let args = tl.getInput("arguments");
    if (args) {
        throw new Error(tl.loc('ArgumentsNotSupportedWithBuildAndPush'));
    }

    let dockerbuild = require("./dockerbuild");
    let dockerpush = require("./dockerpush");

    let outputPaths = "";
    let promise = dockerbuild.run(connection, (outputPath) => outputPaths += outputPath).then(() => {
        dockerpush.run(connection, (outputPath) => outputPaths += ("\n" + outputPath)).then(() => {
            outputUpdate(outputPaths);
        });
    })
    
    return promise;
}