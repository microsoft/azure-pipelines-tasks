"use strict";

import path = require('path');
import * as tl from "azure-pipelines-task-lib/task";
import RegistryAuthenticationToken from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";

export async function dockerBuildAndPush() {
    let endpointId = tl.getInput("dockerRegistryServiceConnection");
    let registryAuthenticationToken: RegistryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(endpointId);

    // Connect to any specified container registry
    let connection = new ContainerConnection();
    connection.open(null, registryAuthenticationToken, true, false);

    /* tslint:disable:no-var-requires */
    let commandImplementation = require("./dockerbuild");
    await commandImplementation.runBuild(connection).then(() => {}).catch((error) => {
        throw new Error(error.message);
    });

    if (tl.getInput("dockerRegistryServiceConnection")) {
        commandImplementation = require("./dockerpush")
        await commandImplementation.run(connection).then(() => {}).catch((error) => {
            throw new Error(error.message);
        });
    }
}
