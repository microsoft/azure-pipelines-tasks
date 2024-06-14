import RegistryAuthenticationToken from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";


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