import RegistryAuthenticationToken from "docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "docker-common-v2/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import * as dockerCommandUtils from "docker-common-v2/dockercommandutils";


export class ContainerRegistry {
    constructor(registryConnection: string) {
        let registryAuthenticationToken: RegistryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(registryConnection);
        this.connection = new ContainerConnection();
        this.connection.open(null, registryAuthenticationToken, true, false);
    }

    public getQualifiedImageName(repository: string, tag: string){
        return `${this.connection.getQualifiedImageName(repository, true)}:${tag}`
    }

    public async pull(repository: string, tag: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            try {
                const imageName = this.getQualifiedImageName(repository, tag);
                dockerCommandUtils.command(this.connection, "pull", imageName, (output: any) => {
                    resolve(output);
                })
            } catch (error) {
                reject(error);
            }
        });
    }

    private connection: ContainerConnection;
}