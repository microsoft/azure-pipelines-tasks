"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import ClusterConnection from "./clusterconnection";

import AuthenticationToken from "docker-common/registryauthenticationprovider/registryauthenticationtoken"

export function run(connection: ClusterConnection, authenticationToken: AuthenticationToken, secret: string): any {
    tl.debug(tl.loc("CreatingSecret"));
    var command = connection.createCommand();
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