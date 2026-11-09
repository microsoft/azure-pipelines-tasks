import * as assert from 'assert';
import * as util from 'util';
import { BuildClient } from '../src/build/buildClient';
import { HttpClient } from '../src/http/httpClient';
import { BuildResult } from '../src/build/buildClient';
import { resolveDefinitionId, resolveProjectId, resolveSpecificRun, resolveTriggeringPipelineId, selectLatestBuildId, getResultFilter, RunVersion } from '../src/build/buildSelection';
import { FakeBuildService } from './fakeBuildService';

function loc(key: string, ...args: unknown[]): string {
    const messages: Record<string, string> = {
        CannotBeNullOrEmpty: '%s cannot be null or empty.',
        PipelineDoesNotExist: 'The following pipeline does not exist: %s. Please verify the name of the pipeline.',
        BuildsDoesNotExist: 'No builds currently exist in the pipeline definition supplied.',
        RunIDNotValid: 'Run Id is not valid: %s'
    };
    return util.format(messages[key] ?? key, ...args);
}

describe('build selection', function () {
    this.timeout(60000);

    let service: FakeBuildService;
    let http: HttpClient;
    let client: BuildClient;
    let logs: string[];

    beforeEach(async () => {
        logs = [];
        service = new FakeBuildService();
        service.addProject({ id: '11111111-1111-1111-1111-111111111111', name: 'project-a' });
        service.addDefinition({ id: 42, name: 'main-pipeline', project: '11111111-1111-1111-1111-111111111111' });
        service.addDefinition({ id: 77, name: 'other-pipeline', project: '11111111-1111-1111-1111-111111111111' });
        service.addBuild({ id: 101, buildNumber: '101', status: 'completed', result: 'succeeded', sourceBranch: 'refs/heads/main', tags: ['release'], finishTime: '2025-01-01T00:00:00Z', definition: { id: 42, name: 'main-pipeline' }, project: { id: '11111111-1111-1111-1111-111111111111', name: 'project-a' } });
        service.addBuild({ id: 102, buildNumber: '102', status: 'completed', result: 'failed', sourceBranch: 'refs/heads/main', tags: ['release'], finishTime: '2025-01-02T00:00:00Z', definition: { id: 42, name: 'main-pipeline' }, project: { id: '11111111-1111-1111-1111-111111111111', name: 'project-a' } });
        service.addBuild({ id: 103, buildNumber: '103', status: 'completed', result: 'canceled', sourceBranch: 'refs/heads/main', tags: ['release'], finishTime: '2025-01-03T00:00:00Z', definition: { id: 42, name: 'main-pipeline' }, project: { id: '11111111-1111-1111-1111-111111111111', name: 'project-a' } });
        service.addBuild({ id: 104, buildNumber: '104', status: 'completed', result: 'partiallysucceeded', sourceBranch: 'refs/heads/dev', tags: ['release'], finishTime: '2025-01-04T00:00:00Z', definition: { id: 42, name: 'main-pipeline' }, project: { id: '11111111-1111-1111-1111-111111111111', name: 'project-a' } });
        service.addBuild({ id: 105, buildNumber: '105', status: 'completed', result: 'succeeded', sourceBranch: 'refs/heads/main', tags: ['other'], finishTime: '2025-01-05T00:00:00Z', definition: { id: 42, name: 'main-pipeline' }, project: { id: '11111111-1111-1111-1111-111111111111', name: 'project-a' } });
        await service.start();
        http = new HttpClient({ authorization: () => '******', allowInsecureLoopback: true, userAgent: 'tests' });
        client = new BuildClient(http, service.baseUrl + '/');
    });

    afterEach(async () => {
        http.close();
        await service.stop();
    });

    function context() {
        return { buildClient: client, loc, debug: (message: string) => logs.push(message) };
    }

    it('returns the project id unchanged when the input is already a guid', async () => {
        const projectId = await resolveProjectId(context(), '11111111-1111-1111-1111-111111111111');
        assert.strictEqual(projectId, '11111111-1111-1111-1111-111111111111');
        assert.strictEqual(service.countRequests('GET', '/_apis/projects/'), 0);
    });

    it('resolves the project by name and retries transient failures through the build client', async () => {
        let failures = 0;
        service.fault = request => {
            if (request.method === 'GET' && request.path.startsWith('/_apis/projects/project-a') && failures++ === 0) {
                return 503;
            }
            return undefined;
        };

        const projectId = await resolveProjectId(context(), 'project-a');
        assert.strictEqual(projectId, '11111111-1111-1111-1111-111111111111');
        assert.strictEqual(service.countRequests('GET', '/_apis/projects/project-a'), 2);
    });

    it('resolves definitions by numeric id or by name', async () => {
        assert.strictEqual(await resolveDefinitionId(context(), '11111111-1111-1111-1111-111111111111', '42'), 42);
        assert.strictEqual(await resolveDefinitionId(context(), '11111111-1111-1111-1111-111111111111', 'main-pipeline'), 42);
    });

    it('throws the agent message when the pipeline definition does not exist', async () => {
        await assert.rejects(
            () => resolveDefinitionId(context(), '11111111-1111-1111-1111-111111111111', 'missing'),
            /The following pipeline does not exist: missing/
        );
    });

    it('selects the latest build with tag and result filters', async () => {
        const buildId = await selectLatestBuildId(context(), {
            pipelineDefinition: 'main-pipeline',
            project: '11111111-1111-1111-1111-111111111111',
            runVersion: RunVersion.Latest,
            tagFilters: ['release'],
            resultFilter: BuildResult.Succeeded | BuildResult.Failed
        });

        assert.strictEqual(buildId, 102);
    });

    it('selects the latest build from a specific branch', async () => {
        const buildId = await selectLatestBuildId(context(), {
            pipelineDefinition: '42',
            project: '11111111-1111-1111-1111-111111111111',
            runVersion: RunVersion.LatestFromBranch,
            branchName: 'refs/heads/dev',
            tagFilters: ['release'],
            resultFilter: BuildResult.Succeeded | BuildResult.PartiallySucceeded
        });

        assert.strictEqual(buildId, 104);
    });

    it('throws the agent message when no build matches the filters', async () => {
        await assert.rejects(
            () => selectLatestBuildId(context(), {
                pipelineDefinition: '42',
                project: '11111111-1111-1111-1111-111111111111',
                runVersion: RunVersion.LatestFromBranch,
                branchName: 'refs/heads/missing',
                tagFilters: ['release'],
                resultFilter: BuildResult.Succeeded
            }),
            /No builds currently exist in the pipeline definition supplied\./
        );
    });

    it('builds the same result filter flags as the plugin', () => {
        assert.strictEqual(getResultFilter(false, false, false), 2);
        assert.strictEqual(getResultFilter(true, true, true), 46);
    });

    it('resolves the triggering pipeline in build and release environments', () => {
        const buildVariables = new Map<string, string>([
            ['system.hostType', 'Build'],
            ['build.triggeredBy.definitionId', '42'],
            ['build.triggeredBy.buildId', '88']
        ]);
        assert.strictEqual(resolveTriggeringPipelineId(name => buildVariables.get(name), '42', message => logs.push(message)), 88);

        const releaseVariables = new Map<string, string>([
            ['system.hostType', 'Release'],
            ['release.triggeringartifact.alias', 'primary'],
            ['release.artifacts.primary.definitionId', '42'],
            ['release.artifacts.primary.buildId', '99']
        ]);
        assert.strictEqual(resolveTriggeringPipelineId(name => releaseVariables.get(name), '42', message => logs.push(message)), 99);
    });

    it('prefers the triggering pipeline when it matches and otherwise falls back to the selected version', async () => {
        const preferred = await resolveSpecificRun(context(), {
            projectInput: 'project-a',
            pipelineDefinition: '42',
            preferTriggeringPipeline: 'true',
            runVersion: RunVersion.Latest,
            tagFilters: ['release'],
            resultFilter: BuildResult.Succeeded,
            getVariable: name => ({ 'system.hostType': 'Build', 'build.triggeredBy.definitionId': '42', 'build.triggeredBy.buildId': '1234' }[name])
        });
        assert.deepStrictEqual(preferred, { projectId: '11111111-1111-1111-1111-111111111111', pipelineId: 1234 });

        const fallback = await resolveSpecificRun(context(), {
            projectInput: 'project-a',
            pipelineDefinition: '42',
            preferTriggeringPipeline: 'true',
            runVersion: RunVersion.Specific,
            runIdInput: '333',
            tagFilters: ['release'],
            resultFilter: BuildResult.Succeeded,
            getVariable: name => ({ 'system.hostType': 'Build', 'build.triggeredBy.definitionId': '77', 'build.triggeredBy.buildId': '999' }[name])
        });
        assert.deepStrictEqual(fallback, { projectId: '11111111-1111-1111-1111-111111111111', pipelineId: 333 });
    });

    it('reads project ids like Guid.TryParse and writes them in the lower case "D" form', async () => {
        for (const input of ['{11111111-1111-1111-1111-111111111111}', '(11111111-1111-1111-1111-111111111111)', '11111111111111111111111111111111', ' 11111111-1111-1111-1111-111111111111 ']) {
            assert.strictEqual(await resolveProjectId(context(), input), '11111111-1111-1111-1111-111111111111', input);
        }
        assert.strictEqual(await resolveProjectId(context(), 'ABCDEF01-1111-1111-1111-111111111111'), 'abcdef01-1111-1111-1111-111111111111');
        assert.strictEqual(service.countRequests('GET', '/_apis/projects/'), 0);
    });

    it('reads definition and run ids like int.TryParse', async () => {
        const projectId = '11111111-1111-1111-1111-111111111111';
        assert.strictEqual(await resolveDefinitionId(context(), projectId, ' 42 '), 42);
        assert.strictEqual(await resolveDefinitionId(context(), projectId, '+42'), 42);
        await assert.rejects(() => resolveDefinitionId(context(), projectId, '42.0'), /The following pipeline does not exist: 42\.0/);

        const specific = (runIdInput: string) => resolveSpecificRun(context(), {
            projectInput: 'project-a',
            pipelineDefinition: '42',
            runVersion: RunVersion.Specific,
            runIdInput,
            tagFilters: [],
            resultFilter: BuildResult.Succeeded,
            getVariable: () => undefined
        });
        assert.strictEqual((await specific(' 101 ')).pipelineId, 101);
        for (const bad of ['101x', '1e3', '2147483648', '']) {
            await assert.rejects(() => specific(bad), new RegExp(`Run Id is not valid: ${bad}$`), bad);
        }
    });

    it('treats a project name of only white space as given, and an empty one as missing, like string.IsNullOrEmpty', async () => {
        const specific = (projectInput: string) => resolveSpecificRun(context(), {
            projectInput,
            pipelineDefinition: '42',
            runVersion: RunVersion.Specific,
            runIdInput: '101',
            tagFilters: [],
            resultFilter: BuildResult.Succeeded,
            getVariable: () => undefined
        });
        await assert.rejects(() => specific(''), /Project Name cannot be null or empty\./);
        await assert.rejects(() => specific('  '), /Get project failed for project:   $/);
    });

    it('uses the white space of .NET, not the white space of JavaScript, for blank definitions and variables', async () => {
        const projectId = '11111111-1111-1111-1111-111111111111';
        await assert.rejects(() => resolveDefinitionId(context(), projectId, ' \u0085\u2003'), /Pipeline Definition cannot be null or empty\./);
        await assert.rejects(() => resolveDefinitionId(context(), projectId, '\ufeff'), /The following pipeline does not exist: \ufeff/);

        const variables = (hostType: string, buildId: string) => new Map<string, string>([
            ['system.hostType', hostType],
            ['build.triggeredBy.definitionId', '42'],
            ['build.triggeredBy.buildId', buildId],
            ['release.triggeringartifact.alias', 'primary'],
            ['release.artifacts.primary.definitionId', '42'],
            ['release.artifacts.primary.buildId', '99']
        ]);
        assert.strictEqual(resolveTriggeringPipelineId(name => variables('Build', '\u0085').get(name), '42'), 0);
        assert.throws(() => resolveTriggeringPipelineId(name => variables('Build', '\ufeff').get(name), '42'), /Triggering pipeline id is not valid/);
        assert.strictEqual(resolveTriggeringPipelineId(name => variables('\u0085', '88').get(name), '42'), 88);
        assert.strictEqual(resolveTriggeringPipelineId(name => variables('\ufeff', '88').get(name), '42'), 99);
    });

    it('reads the preference for the triggering pipeline like bool.TryParse', async () => {
        const run = (preferTriggeringPipeline: string | boolean) => resolveSpecificRun(context(), {
            projectInput: 'project-a',
            pipelineDefinition: '42',
            preferTriggeringPipeline,
            runVersion: RunVersion.Specific,
            runIdInput: '333',
            tagFilters: [],
            resultFilter: BuildResult.Succeeded,
            getVariable: name => ({ 'system.hostType': 'Build', 'build.triggeredBy.definitionId': '42', 'build.triggeredBy.buildId': '1234' }[name])
        });
        for (const preferred of ['true', 'TRUE', ' \u0085True\u2003 ', true]) {
            assert.strictEqual((await run(preferred)).pipelineId, 1234, String(preferred));
        }
        for (const ignored of ['false', '\ufefftrue', 'yes', '1', false]) {
            assert.strictEqual((await run(ignored)).pipelineId, 333, String(ignored));
        }
    });
});
