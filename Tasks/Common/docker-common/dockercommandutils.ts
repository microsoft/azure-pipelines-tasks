"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "./containerconnection";
import * as pipelineUtils from "./pipelineutils";

export function build(connection: ContainerConnection, dockerFile: string, context: string, commandArguments: string, tagArguments: string[], onCommandOut: (output) => any): any {
    var command = connection.createCommand();

    command.arg("build");    
    command.arg(["-f", dockerFile]);
    pipelineUtils.addDefaultLabels(command);
    command.line(commandArguments);
    
    if (tagArguments) {
        tagArguments.forEach(tagArgument => {
            command.arg(["-t", tagArgument]);
        });
    }
    
    command.arg(context);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(output);
    });
}

export function command(connection: ContainerConnection, dockerCommand: string, commandArguments: string, onCommandOut: (output) => any): any {
    let command = connection.createCommand();
    command.arg(dockerCommand);
    command.line(commandArguments);
    
    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });
   
    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(output);
    });
}

export function push(connection: ContainerConnection, image: string, commandArguments: string, onCommandOut: (output) => any): any {
    var command = connection.createCommand();
    command.arg("push");
    command.arg(image);
    command.line(commandArguments);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(output + "\n");
    });
}