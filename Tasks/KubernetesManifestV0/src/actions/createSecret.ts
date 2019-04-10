"use strict";

import tl = require('vsts-task-lib/task');
import { Kubectl } from "kubernetes-common/kubectl-object-model";
import * as utils from "../utils/utilities";
import * as TaskInputParameters from '../models/TaskInputParameters';
import AuthenticationToken from "docker-common/registryauthenticationprovider/registryauthenticationtoken";
import { getDockerRegistryEndpointAuthenticationToken } from "docker-common/registryauthenticationprovider/registryauthenticationtoken";

export async function createSecret() {
    let args = "";
    if (utils.isEqual(TaskInputParameters.secretType, "dockerRegistry", utils.StringComparer.OrdinalIgnoreCase)) {
        args = getDockerRegistrySecretArgs();
    }
    else {
        args = getGenericSecretArgs();
    }

    let kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace);
    var result = kubectl.createSecret(args, true, TaskInputParameters.secretName.trim());
    utils.checkForErrors([result]);
}

let getDockerRegistrySecretArgs = () => {
    let authProvider: AuthenticationToken = getDockerRegistryEndpointAuthenticationToken(TaskInputParameters.dockerRegistryEndpoint);
    return `docker-registry ${TaskInputParameters.secretName.trim()} --docker-username=${authProvider.getUsername()} --docker-password=${authProvider.getPassword()} --docker-server=${authProvider.getLoginServerUrl()} --docker-email=${authProvider.getEmail()}`;
}

let getGenericSecretArgs = () => {
    return `generic ${TaskInputParameters.secretName.trim()} ${TaskInputParameters.secretArguments}`
}