import * as assert from 'assert';
import * as mocker from 'azure-pipelines-task-lib/lib-mocker';
import { writeExternalOutput } from 'azure-pipelines-task-lib/externaloutput';
import type { ExternalOutputOptions } from 'azure-pipelines-task-lib';
import { Writable } from 'stream';
import { format } from 'util';

interface Scenario {
    feedType: string;
    version: string;
    packageName: string;
    feedId: string;
    projectId: string;
    exitCode: number;
    selector?: string;
}

const scenario: Scenario = JSON.parse(process.argv[2]);
const inputs: { [key: string]: string } = {
    publishDirectory: 'package-directory',
    publishedPackageVar: 'publishedPackage',
    versionPublishSelector: scenario.selector || 'custom',
    internalOrExternalPublish: scenario.feedType,
    packageListPublish: scenario.packageName,
    packagePublishExternal: scenario.packageName,
    versionPublish: scenario.version,
    verbosity: 'None',
    packagePublishDescription: 'package description'
};
const results: string[] = [];
const variables: { [key: string]: string } = {};
const invocations: string[][] = [];
let output = '';
let diagnostics = 0;
let versionLookups = 0;
const destination = new Writable({
    write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
    }
});
const serviceUri = 'https://example.invalid';
const accessToken = 'test-token';

mocker.enable({ warnOnUnregistered: false });
mocker.registerMock('azure-pipelines-task-lib', {
    getInput: (name: string) => inputs[name],
    getVariable: () => undefined,
    getEndpointUrl: () => serviceUri,
    loc: (key: string, ...args: string[]) => key === 'Info_Publishing'
        ? format('Publishing package: %s, version: %s using feed id: %s, project: %s', ...args)
        : key,
    debug: () => {},
    warning: () => {},
    error: () => {},
    TaskResult: { Succeeded: 'Succeeded', Failed: 'Failed' },
    setResult: (result: string) => results.push(result),
    setVariable: (name: string, value: string) => { variables[name] = value; },
    writeExternalOutput: (message: string, options: ExternalOutputOptions) => {
        assert.deepStrictEqual(options, { source: 'repository', vsoCommandMode: 'blockOnly' });
        diagnostics++;
        writeExternalOutput(message, { ...options, destination });
    }
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', {
    getSystemAccessToken: () => accessToken,
    getNuGetUriFromBaseServiceUri: async () => serviceUri,
    getFeedUriFromBaseServiceUri: async () => serviceUri,
    getWebApiWithProxy: () => ({ serverUrl: serviceUri, authHandler: {}, options: {} })
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/provenance', {
    ProvenanceHelper: { GetSessionId: async () => scenario.feedId }
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/util', {
    getProjectAndFeedIdFromInputParam: () => ({ feedId: scenario.feedId, projectId: scenario.projectId }),
    logError: () => {}
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/universal/Authentication', {
    InternalAuthInfo: class {
        constructor(public uriPrefixes: string[], public accessToken: string) {}
    },
    GetExternalAuthInfo: () => ({ packageSource: { accountUrl: serviceUri }, token: accessToken })
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities', {
    getHighestPackageVersionFromFeed: async () => {
        versionLookups++;
        return versionLookups === 1 ? '1.0.0' : '1.0.1';
    },
    getVersionUtility: (_selector: string, version: string) => version === '1.0.0' ? '1.0.1' : '1.0.2'
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner', {
    getOptions: () => ({ env: {} }),
    runArtifactTool: (toolPath: string, command: string[], options: { env: { UNIVERSAL_PUBLISH_PAT: string } }) => {
        assert.strictEqual(toolPath, 'artifacttool');
        assert.strictEqual(options.env.UNIVERSAL_PUBLISH_PAT, accessToken);
        invocations.push(command);
        return {
            code: scenario.selector && invocations.length > 1 ? 0 : scenario.exitCode,
            stderr: 'controlled tool failure'
        };
    }
});
mocker.registerMock('azure-pipelines-tasks-utility-common/telemetry', { logResult: () => {} });

async function run(): Promise<void> {
    const publish = await import('../universalpublish');
    await publish.run('artifacttool');

    const retry = !!scenario.selector && scenario.exitCode === 17;
    const expectedVersions = scenario.selector
        ? retry ? ['1.0.1', '1.0.2'] : ['1.0.1']
        : [scenario.version];
    assert.strictEqual(invocations.length, expectedVersions.length);
    assert.strictEqual(diagnostics, expectedVersions.length);
    assert.strictEqual(versionLookups, scenario.selector ? expectedVersions.length : 0);
    let expectedOutput = '';
    expectedVersions.forEach((version, index) => {
        const expectedCommand = [
            'universal', 'publish', '--feed', scenario.feedId, '--service', serviceUri,
            '--package-name', scenario.packageName, '--package-version', version,
            '--path', inputs.publishDirectory, '--patvar', 'UNIVERSAL_PUBLISH_PAT',
            '--verbosity', inputs.verbosity, '--description', inputs.packagePublishDescription
        ];
        if (scenario.projectId) {
            expectedCommand.push('--project', scenario.projectId);
        }
        assert.deepStrictEqual(invocations[index], expectedCommand);
        expectedOutput += format('Publishing package: %s, version: %s using feed id: %s, project: %s\n',
            scenario.packageName, version, scenario.feedId, scenario.projectId).split('##vso[').join('##_vso[');
    });
    assert.strictEqual(output, expectedOutput);
    assert.strictEqual(output.includes('##vso['), false);
    const succeeded = scenario.exitCode === 0 || retry;
    assert.deepStrictEqual(results, [succeeded ? 'Succeeded' : 'Failed']);
    assert.deepStrictEqual(variables, succeeded
        ? { publishedPackage: `${scenario.packageName} ${expectedVersions[expectedVersions.length - 1]}` }
        : {});
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
