'use strict';

import { Kubectl } from 'kubernetes-common/kubectl-object-model';
import * as utils from '../utils/utilities';
import * as TaskInputParameters from '../models/TaskInputParameters';
import AuthenticationToken from 'docker-common/registryauthenticationprovider/registryauthenticationtoken';
import { getDockerRegistryEndpointAuthenticationToken } from 'docker-common/registryauthenticationprovider/registryauthenticationtoken';

const getDockerRegistrySecretArgs = () => {
    const authProvider: AuthenticationToken = getDockerRegistryEndpointAuthenticationToken(TaskInputParameters.dockerRegistryEndpoint);
    return `docker-registry ${TaskInputParameters.secretName.trim()} --docker-username=${authProvider.getUsername()} --docker-password=${authProvider.getPassword()} --docker-server=${authProvider.getLoginServerUrl()} --docker-email=${authProvider.getEmail()}`;
};

const getGenericSecretArgs = () => {
    return `generic ${TaskInputParameters.secretName.trim()} ${TaskInputParameters.secretArguments}`;
};

export async function createSecret(ignoreSslErrors?: boolean) {
    let args = '';
    if (utils.isEqual(TaskInputParameters.secretType, 'dockerRegistry', utils.StringComparer.OrdinalIgnoreCase)) {
        args = getDockerRegistrySecretArgs();
    } else {
        args = getGenericSecretArgs();
    }

    const kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace, ignoreSslErrors);
    const result = kubectl.createSecret(args, true, TaskInputParameters.secretName.trim());
    utils.checkForErrors([result]);
}