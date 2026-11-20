import { WebApi } from 'azure-devops-node-api';
import { IBuildApi } from 'azure-devops-node-api/BuildApi';
import { getServiceConnectionHandler } from './auth';

class API {
    public readonly tasks: string[];

    private readonly projectName: string;
    private readonly webApi: WebApi;
    private buildApi: IBuildApi | null = null;

    constructor(argv: string[]) {
        const authHandler = getServiceConnectionHandler(process.env.CANARY_BUILDS_ACCESS_TOKEN || '');
        const adoUrl = argv[2];
        if (!adoUrl) {
            throw new Error('ADO url is not provided');
        }
        this.projectName = argv[3];
        if (!this.projectName) {
            throw new Error('Project name is not provided');
        }
        const TaskArg = argv[4];
        if (!TaskArg) {
            throw new Error('Task list is not provided');
        }

        this.tasks = TaskArg.split(',');
        this.webApi = new WebApi(adoUrl, authHandler);
    }

    public async getDefinitions() {
        const api = await this.getBuildApi();

        return await api.getDefinitions(this.projectName);
    }

    public async getBuild(buildId: number) {
        const api = await this.getBuildApi();

        return await api.getBuild(this.projectName, buildId);
    }

    public async queueBuild(definitionId: number, parameters = {}) {
        const api = await this.getBuildApi();

        return await api.queueBuild({
            definition: { id: definitionId },
            parameters: JSON.stringify(parameters)
        }, this.projectName);
    }

    public async addBuildTags(buildId: number, tags: string[]) {
        const api = await this.getBuildApi();

        return await api.addBuildTags(tags, this.projectName, buildId);
    }

    public async updateBuild(buildId: number) {
        const api = await this.getBuildApi();

        return await api.updateBuild({}, this.projectName, buildId, true);
    }
    public async getDefinition(definitionId: number) {
        const api = await this.getBuildApi();

        return await api.getDefinition(this.projectName, definitionId);
    }

    private async getBuildApi() {
        if (!this.buildApi) this.buildApi = await this.webApi.getBuildApi();

        return this.buildApi;
    }
}

export const api = new API(process.argv);