import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import { isNullOrWhiteSpace, parseDotNetInt32, readJsonStringMap, requireProjectGuid } from 'azure-pipelines-tasks-pipeline-artifacts-common';

export interface ScenarioOptions {
    inputs?: { [name: string]: string | undefined };
    variables?: { [name: string]: string | undefined };
    coreMock?: any;
}

const baseVariables: { [name: string]: string } = {
    'System.ServerType': 'Hosted',
    'System.HostType': 'build',
    'System.TeamProjectId': '11111111-2222-3333-4444-555555555555',
    'System.TeamFoundationCollectionUri': 'https://dev.azure.com/org/',
    'Build.BuildId': '42',
    'System.JobId': 'job-guid',
    'System.JobIdentifier': 'Build.Job-1.default',
    'system.defaultworkingdirectory': __dirname
};

export function createRunner(options: ScenarioOptions = {}): tmrm.TaskMockRunner {
    const tmr = new tmrm.TaskMockRunner(path.join(__dirname, '..', 'main.js'));

    const inputs: { [name: string]: string | undefined } = { path: __dirname, ...options.inputs };
    for (const name of Object.keys(inputs)) {
        const value = inputs[name];
        if (value !== undefined) {
            tmr.setInput(name, value);
        }
    }

    const variables = { ...baseVariables, ...options.variables };
    for (const name of Object.keys(variables)) {
        const value = variables[name];
        if (value !== undefined) {
            process.env[name.replace(/\./g, '_').replace(/ /g, '_').toUpperCase()] = value;
        }
    }
    process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = '{"parameters":{"AccessToken":"token"},"scheme":"OAuth"}';
    process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = 'token';

    tmr.registerMock('azure-pipelines-tasks-pipeline-artifacts-common', options.coreMock ?? defaultCoreMock());
    return tmr;
}

export function defaultCoreMock(): any {
    return {
        isNullOrWhiteSpace,
        parseDotNetInt32,
        readJsonStringMap,
        requireProjectGuid,
        HttpClient: class { close() { } },
        BuildClient: class { async createArtifact() { return { id: 1 }; } },
        publishPipelineArtifact: async (options: any) => {
            const { http, logger, ...rest } = options;
            console.log('PUBLISH ' + JSON.stringify(rest));
            return { artifactId: 1 };
        }
    };
}
