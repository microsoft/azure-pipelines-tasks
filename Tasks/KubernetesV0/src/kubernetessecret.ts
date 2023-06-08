"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as kubernetesCommand from "./kubernetescommand";
import ClusterConnection from "./clusterconnection";

import AuthenticationToken from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken"

export function run(connection: ClusterConnection, authenticationToken: AuthenticationToken, secret: string): any {
   
    if(tl.getBoolInput("forceUpdate") == true) {
        return deleteSecret(connection, secret).fin(() =>{
            return createSecret(connection, authenticationToken, secret);
        });
    } else {
        return createSecret(connection, authenticationToken, secret);
    } 
}

function createSecret(connection: ClusterConnection, authenticationToken: AuthenticationToken, secret: string): any {
    var typeOfSecret = tl.getInput("secretType", true);
    if (typeOfSecret === "dockerRegistry")
    {
        return createDockerRegistrySecret(connection, authenticationToken, secret);
    }
    else if (typeOfSecret === "generic")
    {
        return createGenericSecret(connection, secret);
    }
}

function deleteSecret(connection: ClusterConnection, secret: string): any {
    tl.debug(tl.loc('DeleteSecret', secret));
    var command = connection.createCommand();
    command.arg(kubernetesCommand.getNameSpace());
    command.arg("delete");
    command.arg("secret");
    command.arg(secret);
    var executionOption : tr.IExecOptions = <any> {
                                                    silent: true,
                                                    failOnStdErr: false,
                                                    ignoreReturnCode: true
                                                };

    return connection.execCommand(command, executionOption);
}

function createDockerRegistrySecret(connection: ClusterConnection, authenticationToken: AuthenticationToken, secret: string): any {

    if(authenticationToken)
    {
        tl.debug(tl.loc('CreatingSecret', secret));
        var command = connection.createCommand();
        command.arg(kubernetesCommand.getNameSpace());
        command.arg("create")
        command.arg("secret");
        command.arg("docker-registry");
        command.arg(secret);
        command.arg("--docker-server="+ authenticationToken.getLoginServerUrl());
        command.arg("--docker-username="+ authenticationToken.getUsername());
        command.arg("--docker-password="+ authenticationToken.getPassword());
        command.arg("--docker-email="+ authenticationToken.getEmail());
       
        return connection.execCommand(command);
    }
    else
    {
        tl.error(tl.loc("DockerRegistryConnectionNotSpecified"));
        throw new Error(tl.loc("DockerRegistryConnectionNotSpecified"));
    }

}

function createGenericSecret(connection: ClusterConnection, secret: string): any {

    tl.debug(tl.loc('CreatingSecret', secret));
    var command = connection.createCommand();
    command.arg(kubernetesCommand.getNameSpace());
    command.arg("create")
    command.arg("secret");
    command.arg("generic");
    command.arg(secret);
    var secretArguments = tl.getInput("secretArguments", false);
    if (secretArguments)
    {
        command.line(secretArguments);
    }

    return connection.execCommand(command);
}