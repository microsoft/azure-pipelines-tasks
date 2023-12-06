class Config {
    public readonly AuthToken: string;
    public readonly AdoUrl: string;
    public readonly ProjectName: string;
    public readonly TaskArg: string;
    public readonly ApiUrl: string;
    // TODO: Replace axios usage to node-api. Need to add support of Pipelines API.
    public readonly AxiosAuth: { auth: { username: string, password: string } };

    constructor(argv: string[]) {
        this.AuthToken = argv[2];
        if (!this.AuthToken) {
            throw new Error('Auth token is not provided');
        }
        this.AdoUrl = argv[3];
        if (!this.AdoUrl) {
            throw new Error('ADO url is not provided');
        }
        this.ProjectName = argv[4];
        if (!this.ProjectName) {
            throw new Error('Project name is not provided');
        }
        this.TaskArg = argv[5];
        if (!this.TaskArg) {
            throw new Error('Task list is not provided');
        }

        this.ApiUrl = `${this.AdoUrl}/${this.ProjectName}/_apis`;

        this.AxiosAuth = {
            auth: {
                username: 'Basic',
                password: this.AuthToken
            }
        }
    }
}

export const configInstance = new Config(process.argv);
