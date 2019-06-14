'use strict';

import { Kubectl } from 'kubernetes-common-v2/kubectl-object-model';
import * as utils from '../utils/utilities';
import * as TaskInputParameters from '../models/TaskInputParameters';
import AuthenticationToken from 'docker-common-v2/registryauthenticationprovider/registryauthenticationtoken';
import { getDockerRegistryEndpointAuthenticationToken } from 'docker-common-v2/registryauthenticationprovider/registryauthenticationtoken';

export async function createSecret(ignoreSslErrors?: boolean) {
    const kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace, ignoreSslErrors);
    let result;
    if (utils.isEqual(TaskInputParameters.secretType, 'dockerRegistry', utils.StringComparer.OrdinalIgnoreCase)) {
        const authProvider: AuthenticationToken = getDockerRegistryEndpointAuthenticationToken(TaskInputParameters.dockerRegistryEndpoint);
        result = kubectl.createDockerSecret(TaskInputParameters.secretName.trim(),
            authProvider.getLoginServerUrl(),
            authProvider.getUsername(),
            authProvider.getPassword(),
            authProvider.getEmail(),
            true);
    } else {
        result = kubectl.createGenericSecret(TaskInputParameters.secretName.trim(),
            TaskInputParameters.secretArguments.trim(),
            true);
    }

    utils.checkForErrors([result]);
}