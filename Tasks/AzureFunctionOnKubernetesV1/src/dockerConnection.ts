'use strict';

import * as url from "url";
import * as tl from 'azure-pipelines-task-lib/task';
import * as ImageUtils from "azure-pipelines-tasks-docker-common-v2/containerimageutils";
import ContainerConnection from "azure-pipelines-tasks-docker-common-v2/containerconnection";
import RegistryServerAuthenticationToken from "azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import { getDockerRegistryEndpointAuthenticationToken } from "azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";

export class DockerConnection {
    private connection: ContainerConnection;
    private registryAuthenticationToken: RegistryServerAuthenticationToken;

    public async open() {      
        const endpointId = tl.getInput("dockerRegistryServiceConnection", true);
        this.registryAuthenticationToken = await getDockerRegistryEndpointAuthenticationToken(endpointId);        
        this.connection = new ContainerConnection();
        this.connection.open(null, this.registryAuthenticationToken);
    }

    public getRegistry() {
        let registry = '';
        if (this.registryAuthenticationToken) {
            const registryUrl = this.registryAuthenticationToken.getLoginServerUrl();
            registry = this.getHostName(registryUrl);
        }

        return registry;
    }

    public close() {
        if (this.connection) {
            this.connection.close();
        }
    }

    private getHostName(registryUrl: string) {
        const uri = url.parse(registryUrl);
        const host = !uri.slashes ? uri.href : uri.host;
        return host;
    }
}