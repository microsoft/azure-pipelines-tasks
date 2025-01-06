import RegistryAuthenticationToken from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";


export class ContainerRegistry {
    constructor() {
        this._connection = new ContainerConnection();
    }

    public async open(registryConnection: string) {
        let registryAuthenticationToken: RegistryAuthenticationToken = await getDockerRegistryEndpointAuthenticationToken(registryConnection);
        this._connection.open(null, registryAuthenticationToken, true, false);
    }

    public getQualifiedImageName(repository: string, tag: string){
        return `${this._connection.getQualifiedImageName(repository, true)}:${tag}`;
    }

    public async pull(repository: string, tag: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            try {
                const imageName = this.getQualifiedImageName(repository, tag);
                dockerCommandUtils.command(this._connection, "pull", imageName, (output: any) => {
                    resolve(output);
                })
            } catch (error) {
                reject(error);
            }
        });
    }

    private _connection: ContainerConnection;
}