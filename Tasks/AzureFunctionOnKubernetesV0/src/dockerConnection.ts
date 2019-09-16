import * as url from "url";
import * as tl from 'azure-pipelines-task-lib/task';
import * as ImageUtils from "docker-common-v2/containerimageutils";
import ContainerConnection from "docker-common-v2/containerconnection";
import RegistryAuthenticationToken from "docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
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

    public getQualifiedImageName(imageName): string {
        if (!imageName) {
            return '';
        }

        let qualifiedName = this.connection.getQualifiedImageNameIfRequired(imageName);
        qualifiedName = ImageUtils.generateValidImageName(qualifiedName);
        return qualifiedName;
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