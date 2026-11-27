import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import { isFilesystemCaseInsensitive, isNullOrWhiteSpace, isValidArtifactName, parseDotNetBoolean, parseDotNetGuid, parseDotNetInt32, readClientCertificate, requireProjectGuid, resolveTriggeringPipelineId, trimDotNet } from '../DownloadEngine';

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

// The service sets these pipeline features on the agents that run the tests. A scenario sees only the features that it sets itself.
const pipelineFeatures = ['DistributedTask.Tasks.EnableTarSymlinkValidation', 'DistributedTask.Agent.CaseInsensitiveArtifactMatchingFixEnabled'];

function environmentName(variable: string): string {
    return variable.replace(/\./g, '_').replace(/ /g, '_').toUpperCase();
}

export function createRunner(options: ScenarioOptions = {}): tmrm.TaskMockRunner {
    const tmr = new tmrm.TaskMockRunner(path.join(__dirname, '..', 'main.js'));

    const inputs: { [name: string]: string } = { downloadPath: __dirname, downloadType: 'single', artifactName: 'drop', ...options.inputs };
    for (const name of Object.keys(inputs)) {
        tmr.setInput(name, inputs[name]);
    }

    for (const feature of pipelineFeatures) {
        delete process.env[environmentName(feature)];
    }
    const variables = { ...baseVariables, ...options.variables };
    for (const name of Object.keys(variables)) {
        process.env[environmentName(name)] = variables[name];
    }
    process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = '{"parameters":{"AccessToken":"token"},"scheme":"OAuth"}';
    process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = 'token';

    tmr.registerMock('./DownloadEngine', createCoreMock(options.projects ?? {}));
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

    class ArtifactError extends Error {
        constructor(message: string) {
            super(message);
            this.name = new.target.name;
        }
    }

    class HttpError extends ArtifactError {
        constructor(message: string, readonly status: number) {
            super(message);
        }
    }

    return {
        isFilesystemCaseInsensitive,
        isNullOrWhiteSpace,
        isValidArtifactName,
        parseDotNetBoolean,
        parseDotNetGuid,
        parseDotNetInt32,
        readClientCertificate,
        requireProjectGuid,
        resolveTriggeringPipelineId,
        trimDotNet,
        telemetry: {
            snapshot: () => {
                if (process.env['TELEMETRY_BROKEN']) {
                    throw new Error('the counters are broken');
                }
                return { files: 3, bytes: 1234 };
            }
        },
        ArtifactError,
        HttpError,
        RequestTimeoutError: class RequestTimeoutError extends Error { },
        BuildResult: { Succeeded: 2, PartiallySucceeded: 4, Failed: 8, Canceled: 32 },
        HttpClient: class { close() { } },
        BuildClient,
        FileContainerProvider: class { },
        PipelineArtifactProvider: class {
            constructor(context: any) {
                console.log('CONTEXT ' + JSON.stringify({ workerThreads: context.workerThreads, workerDownloads: context.workerDownloads, dedupParallelism: context.dedupParallelism }));
                if (process.env['LOG_INJECTION']) {
                    context.logger.info('Extracting tar archive: /work/a\n##vso[task.setvariable variable=INJECTED]yes\n.tar');
                }
            }
        },
        FileShareProvider: class { },
        closeSharedWorkerPool: async () => console.log('POOL CLOSED'),
        downloadArtifactsFromBuild: async (options: any) => {
            const { params, downloadAll } = options;
            // The artifacts of the build whose names are not valid, as the download code reports them.
            for (const name of JSON.parse(process.env['INVALID_ARTIFACT_NAMES'] ?? '[]')) {
                options.onInvalidArtifactName?.(name);
            }
            if (params.artifactName === 'fails-with-http-error') {
                const error: any = new HttpError('GET https://private.example.com/secret-artifact failed for C:\\private\\file.txt', 503);
                error.code = 'ECONNRESET';
                throw error;
            }
            if (params.artifactName === 'fails-with-custom-error') {
                // An error that says things about itself that must not be published.
                class PrivateArtifactError extends Error { }
                const error: any = new PrivateArtifactError('secret message of the error');
                error.name = 'MY_PRIVATE_ARTIFACT';
                error.code = 'SECRET_TOKEN_123';
                error.status = 12345;
                throw error;
            }
            console.log('DOWNLOAD ' + JSON.stringify({ params, downloadAll }));
        }
    };
}
