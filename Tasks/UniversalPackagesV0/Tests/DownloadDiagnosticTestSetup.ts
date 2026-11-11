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
    downloadDirectory: string;
    exitCode: number;
}

const scenario: Scenario = JSON.parse(process.argv[2]);
const inputs: { [key: string]: string } = {
    downloadDirectory: scenario.downloadDirectory,
    internalOrExternalDownload: scenario.feedType,
    packageListDownload: scenario.packageName,
    packageDownloadExternal: scenario.packageName,
    versionListDownload: scenario.version,
    versionDownloadExternal: scenario.version,
    verbosity: 'None'
};
const results: string[] = [];
let output = '';
let invocationCount = 0;
let diagnosticCount = 0;
let packageLookups = 0;
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
    getEndpointUrl: () => serviceUri,
    loc: (key: string, ...args: string[]) => key === 'Info_Downloading'
        ? format('Downloading package: %s, version: %s using feed id: %s, project: %s', ...args)
        : key,
    debug: () => {},
    error: () => {},
    TaskResult: { Succeeded: 'Succeeded', Failed: 'Failed' },
    setResult: (result: string) => results.push(result),
    writeExternalOutput: (message: string, options: ExternalOutputOptions) => {
        assert.deepStrictEqual(options, { source: 'repository', vsoCommandMode: 'blockOnly' });
        diagnosticCount++;
        writeExternalOutput(message, { ...options, destination });
    }
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', {
    getSystemAccessToken: () => accessToken,
    getFeedUriFromBaseServiceUri: async () => serviceUri
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/util', {
    getProjectAndFeedIdFromInputParam: (name: string) => {
        assert.strictEqual(name, scenario.feedType === 'internal' ? 'feedListDownload' : 'feedDownloadExternal');
        return { feedId: scenario.feedId, projectId: scenario.projectId };
    }
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/universal/Authentication', {
    InternalAuthInfo: class {
        constructor(public uriPrefixes: string[], public accessToken: string) {}
    },
    GetExternalAuthInfo: (name: string) => {
        assert.strictEqual(name, 'externalEndpoint');
        return { packageSource: { accountUrl: serviceUri }, token: accessToken };
    }
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities', {
    getPackageNameFromId: async (_uri: string, token: string, project: string, feed: string, packageId: string) => {
        assert.strictEqual(token, accessToken);
        assert.strictEqual(project, scenario.projectId);
        assert.strictEqual(feed, scenario.feedId);
        assert.strictEqual(packageId, scenario.packageName);
        packageLookups++;
        return scenario.packageName;
    }
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner', {
    getOptions: () => ({ env: {} }),
    runArtifactTool: (toolPath: string, command: string[], options: { env: { UNIVERSAL_DOWNLOAD_PAT: string } }) => {
        assert.strictEqual(toolPath, 'artifacttool');
        assert.strictEqual(options.env.UNIVERSAL_DOWNLOAD_PAT, accessToken);
        assert.strictEqual(diagnosticCount, 1);
        assert.strictEqual(output.includes('##vso['), false);
        const expectedCommand = [
            'universal', 'download', '--feed', scenario.feedId, '--service', serviceUri,
            '--package-name', scenario.packageName, '--package-version', scenario.version,
            '--path', scenario.downloadDirectory, '--patvar', 'UNIVERSAL_DOWNLOAD_PAT', '--verbosity', 'None'
        ];
        if (scenario.projectId) {
            expectedCommand.push('--project', scenario.projectId);
        }
        assert.deepStrictEqual(command, expectedCommand);
        invocationCount++;
        return { code: scenario.exitCode, stderr: 'controlled tool failure' };
    }
});
mocker.registerMock('azure-pipelines-tasks-utility-common/telemetry', { logResult: () => {} });

async function run(): Promise<void> {
    const download = await import('../universaldownload');
    await download.run('artifacttool');
    assert.strictEqual(invocationCount, 1);
    assert.strictEqual(diagnosticCount, 1);
    assert.strictEqual(packageLookups, scenario.feedType === 'internal' ? 1 : 0);
    const expectedOutput = format('Downloading package: %s, version: %s using feed id: %s, project: %s\n',
        scenario.packageName, scenario.version, scenario.feedId, scenario.projectId)
        .split('##vso[').join('##_vso[');
    assert.strictEqual(output, expectedOutput);
    assert.deepStrictEqual(results, [scenario.exitCode === 0 ? 'Succeeded' : 'Failed']);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
