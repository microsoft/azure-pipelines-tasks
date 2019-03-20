"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "./containerconnection";
import * as pipelineUtils from "./pipelineutils";

export function build(connection: ContainerConnection, dockerFile: string, context: string, commandArguments: string, labelArguments: string[], tagArguments: string[], onCommandOut: (output) => any): any {
    var command = connection.createCommand();

    command.arg("build");    
    command.arg(["-f", dockerFile]);

    if (labelArguments) {
        labelArguments.forEach(label => {
            command.arg(["--label", label]);
        });
    }
    
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

export function getLayers(connection: ContainerConnection, imageId: string): any {
    const NONE_TAG = '<none>:<none>';
    const NOP_PREFIX = '#(nop) ';
    const TOKEN_WHITESPACE = RegExp(/[\t\v\f\r ]+/);

    var imageDetails = images(connection, "--format \"{{json . }}\"").split(/[\r?\n]/);;
    var i = 0;
    var tags: { [imageId: string] : string }  = {}
    for (i = 0; i < imageDetails.length; i++){
        var imageDetail = JSON.parse(imageDetails[i]);
        var tag = imageDetail.info['RepoTags'].first
        if (tag != NONE_TAG){
            tags[imageDetail['Id']] = tag;
        }
    }

    var layers = [];
    while (true){
        if(tags[imageId]){
            layers.push({ Directive : "FROM", Arguments : "", Id : imageId, Size : "", CreatedOn : "" });
        }

        var imageDetail = inspect(connection, imageId);

        if (!imageDetail){
            tl.warning("Specified Image Id : " + imageId + "could not be found.")
            break;
        }

        var cmds = imageDetail.info['ContainerConfig']['Cmd']

        if (cmds && cmds.length > 0){
            var cmd : string = cmds.last;
            if (cmd.startsWith(NOP_PREFIX)){
                cmd.replace(NOP_PREFIX, "");
                var match = cmd.match(TOKEN_WHITESPACE);
                if (!match) {
                    layers.push ({ Directive: "UNSPECIFIED", Arguments: cmd, Id: imageId, Size: "", CreatedOn: "" });
                }
                else {
                    var directive = cmd.substr(0, match.index).toUpperCase().trim();
                    var rest = cmd.substr(match.index + match[0].length).trim();
                    layers.push ({ Directive: directive, Arguments: rest, Id: imageId, Size: "", CreatedOn: "" });
                }
            }
            else {
                layers.push({ Directive: "RUN", Arguments: cmd, Id: imageId, Size: "", CreatedOn: "" });
            }       
        }

        imageId = imageDetail.info['Parent'];

        if (imageId == ''){
            break;
        }
    }
    
    return layers.reverse();
}

export function images(connection: ContainerConnection, commandArguments: string): any {
    var command = connection.createCommand();
    command.arg("images");
    command.line(commandArguments);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        output;
    });
}

export function inspect(connection: ContainerConnection, image: string): any {
    var command = connection.createCommand();
    command.arg("inspect");
    command.arg(image);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        output;
    });
}