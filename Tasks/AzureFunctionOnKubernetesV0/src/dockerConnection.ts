import * as url from "url";
import * as tl from 'azure-pipelines-task-lib/task';
import RegistryAuthenticationToken from "docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "docker-common-v2/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";

export class DockerConnection {
    private connection: ContainerConnection;
    private registryAuthenticationToken: RegistryAuthenticationToken;

    public open() {      
        const endpointId = tl.getInput("dockerRegistryServiceConnection", false);
        if (endpointId) {
            this.registryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(endpointId);
            
            this.connection = new ContainerConnection();
            this.connection.open(null, this.registryAuthenticationToken);
        }
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