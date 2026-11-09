import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import { isNullOrWhiteSpace, parseDotNetBoolean, parseDotNetGuid, parseDotNetInt32, requireProjectGuid, resolveTriggeringPipelineId, trimDotNet } from 'azure-pipelines-tasks-pipeline-artifacts-common';

export interface ScenarioOptions {
    inputs?: { [name: string]: string };
    variables?: { [name: string]: string };
    projects?: { [name: string]: string };
}

const baseVariables: { [name: string]: string } = {
    'System.TeamFoundationCollectionUri': 'https://dev.azure.com/org/',
    'System.TeamProjectId': '11111111-2222-3333-4444-555555555555',
    'Build.BuildId': '42',
    'Agent.TempDirectory': __dirname
};

export function createRunner(options: ScenarioOptions = {}): tmrm.TaskMockRunner {
    const tmr = new tmrm.TaskMockRunner(path.join(__dirname, '..', 'main.js'));

    const inputs: { [name: string]: string } = { downloadPath: __dirname, downloadType: 'single', artifactName: 'drop', ...options.inputs };
    for (const name of Object.keys(inputs)) {
        tmr.setInput(name, inputs[name]);
    }

    const variables = { ...baseVariables, ...options.variables };
    for (const name of Object.keys(variables)) {
        process.env[name.replace(/\./g, '_').replace(/ /g, '_').toUpperCase()] = variables[name];
    }
    process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = '{"parameters":{"AccessToken":"token"},"scheme":"OAuth"}';
    process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = 'token';

    tmr.registerMock('azure-pipelines-tasks-pipeline-artifacts-common', createCoreMock(options.projects ?? {}));
    return tmr;
}

function createCoreMock(projects: { [name: string]: string }): any {
    class BuildClient {
        async getProjectId(name: string): Promise<string> {
            if (!projects[name]) {
                throw new Error('HTTP 404');
            }
            return projects[name];
        }

        async getDefinitionsByName(): Promise<any[]> {
            return [{ id: 12 }];
        }

        async getBuilds(project: string): Promise<any[]> {
            console.log(`BUILDS project=${project}`);
            return [{ id: 7 }];
        }
    }

    return {
        isNullOrWhiteSpace,
        parseDotNetBoolean,
        parseDotNetGuid,
        parseDotNetInt32,
        requireProjectGuid,
        resolveTriggeringPipelineId,
        trimDotNet,
        BuildResult: { Succeeded: 2, PartiallySucceeded: 4, Failed: 8, Canceled: 32 },
        HttpClient: class { close() { } },
        BuildClient,
        FileContainerProvider: class { },
        PipelineArtifactProvider: class { },
        FileShareProvider: class { },
        downloadArtifactsFromBuild: async (options: any) => {
            const { params, downloadAll } = options;
            console.log('DOWNLOAD ' + JSON.stringify({ params, downloadAll }));
        }
    };
}
