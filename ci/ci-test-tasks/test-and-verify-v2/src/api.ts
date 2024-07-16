import { WebApi, getPersonalAccessTokenHandler } from 'azure-devops-node-api';
import { IBuildApi } from 'azure-devops-node-api/BuildApi';

class API {
    public readonly tasks: string[];

    private readonly projectName: string;
    private readonly webApi: WebApi;
    private buildApi: IBuildApi | null = null;

    constructor(argv: string[]) {
        const authToken = argv[2];
        if (!authToken) {
            throw new Error('Auth token is not provided');
        }
        const adoUrl = argv[3];
        if (!adoUrl) {
            throw new Error('ADO url is not provided');
        }
        this.projectName = argv[4];
        if (!this.projectName) {
            throw new Error('Project name is not provided');
        }
        const TaskArg = argv[5];
        if (!TaskArg) {
            throw new Error('Task list is not provided');
        }

        this.tasks = TaskArg.split(',');
        const authHandler = getPersonalAccessTokenHandler(authToken);
        this.webApi = new WebApi(adoUrl, authHandler);
    }

    public async getDefinitions () {
        const api = await this.getBuildApi();

        return await api.getDefinitions(this.projectName);
    }

    public async getBuild (buildId: number) {
        const api = await this.getBuildApi();

        return await api.getBuild(this.projectName, buildId);
    }

    public async queueBuild (definitionId: number, parameters = {}) {
        const api = await this.getBuildApi();

        return await api.queueBuild({
            definition: { id: definitionId },
            parameters: JSON.stringify(parameters)
        }, this.projectName);
    }

    public async updateBuild (buildId: number) {
        const api = await this.getBuildApi();

        return await api.updateBuild({}, this.projectName, buildId, true);
    }

    private async getBuildApi () {
        if (!this.buildApi) this.buildApi = await this.webApi.getBuildApi();

        return this.buildApi;
    }
}

export const api = new API(process.argv);
