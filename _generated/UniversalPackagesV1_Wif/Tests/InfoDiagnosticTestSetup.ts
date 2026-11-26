import * as assert from 'assert';
import * as mocker from 'azure-pipelines-task-lib/lib-mocker';
import { writeExternalOutput } from 'azure-pipelines-task-lib/externaloutput';
import type { ExternalOutputOptions } from 'azure-pipelines-task-lib';
import { Writable } from 'stream';
import { format } from 'util';
import type { UniversalPackageContext } from '../UniversalPackageContext';

interface Scenario {
    command: string;
    version: string;
    packageName: string;
    feedName: string;
    projectName: string;
    directory: string;
    exitCode: number;
    versionIncrement?: string;
}

const scenario: Scenario = JSON.parse(process.argv[2]);
const messages: { [key: string]: string } = {
    Info_PublishingPackage: 'Publishing %s version %s from %s',
    Info_DownloadingPackage: 'Downloading %s version %s to %s',
    Success_PackagesPublished: 'Published %s version %s to %s',
    Success_PackagesDownloaded: 'Downloaded %s version %s from %s',
    Info_UsingIncrementedVersion: 'Using %s increment %s from %s'
};
const serviceUri = 'https://example.invalid/';
const accessToken = 'test-token';
const increments: { [key: string]: string } = { major: '2.0.0', minor: '1.3.0', patch: '1.2.4' };
const version = scenario.versionIncrement ? increments[scenario.versionIncrement] : scenario.version;
const results: string[] = [];
const variables: { [key: string]: string } = {};
const displayedMessages: string[] = [];
let output = '';
let invocationCount = 0;
const destination = new Writable({
    write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
    }
});

mocker.enable({ warnOnUnregistered: false });
mocker.registerMock('azure-pipelines-task-lib', {
    getInput: (name: string) => ({
        command: scenario.command, directory: scenario.directory, feed: scenario.feedName,
        packageName: scenario.packageName, packageVersion: scenario.version,
        versionIncrement: scenario.versionIncrement, packageDescription: 'description'
    })[name],
    getVariable: (name: string) => name === 'Packaging.SavePublishMetadata' ? 'false' : undefined,
    loc: (key: string, ...args: string[]) => messages[key] ? format(messages[key], ...args) : key,
    debug: () => {},
    warning: () => {},
    error: () => {},
    TaskResult: { Succeeded: 'Succeeded', Failed: 'Failed' },
    setResult: (result: string) => results.push(result),
    setVariable: (name: string, value: string, secret: boolean, isOutput: boolean) => {
        assert.strictEqual(secret, false);
        assert.strictEqual(isOutput, true);
        variables[name] = value;
    },
    writeExternalOutput: (message: string, options: ExternalOutputOptions) => {
        assert.deepStrictEqual(options, { source: 'repository', vsoCommandMode: 'blockOnly' });
        displayedMessages.push(message);
        writeExternalOutput(message, { ...options, destination });
    }
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner', {
    runArtifactTool: (tool: string, command: string[], options: { env: { UNIVERSAL_AUTH_TOKEN: string } }) => {
        assert.strictEqual(tool, 'artifacttool');
        assert.strictEqual(options.env.UNIVERSAL_AUTH_TOKEN, accessToken);
        assert.strictEqual(output.includes('##vso['), false);
        assert.strictEqual(displayedMessages.length, scenario.versionIncrement ? 2 : 1);
        const expectedCommand = [
            'universal', scenario.command, '--feed', scenario.feedName, '--service', serviceUri,
            '--package-name', scenario.packageName, '--package-version', version,
            '--path', scenario.directory, '--patvar', 'UNIVERSAL_AUTH_TOKEN', '--verbosity', 'Information'
        ];
        if (scenario.projectName) {
            expectedCommand.push('--project', scenario.projectName);
        }
        if (scenario.command === 'publish') {
            expectedCommand.push('--description', 'description');
        }
        assert.deepStrictEqual(command, expectedCommand);
        invocationCount++;
        return { code: scenario.exitCode, stderr: 'controlled tool failure' };
    }
});
mocker.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities', {
    getHighestPackageVersionFromFeed: async () => '1.2.3',
    getVersionUtility: (increment: string, highest: string) => {
        assert.strictEqual(highest, '1.2.3');
        return increments[increment];
    }
});
mocker.registerMock('azure-pipelines-tasks-utility-common/telemetry', { logResult: () => {} });
mocker.registerMock('azure-pipelines-tasks-artifacts-common/stringUtils', {});
mocker.registerMock('azure-pipelines-tasks-artifacts-common/webapi', {});
mocker.registerMock('azure-pipelines-tasks-artifacts-common/retryUtils', {});
mocker.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {});
mocker.registerMock('azure-pipelines-tasks-packaging-common/provenance', {});

async function run(): Promise<void> {
    const { UniversalPackageContext } = await import('../UniversalPackageContext');
    const context: UniversalPackageContext = new UniversalPackageContext();
    context.feedName = scenario.feedName;
    context.projectName = scenario.projectName;
    context.serviceUri = serviceUri;
    context.feedServiceUri = serviceUri;
    context.accessToken = accessToken;
    context.artifactToolPath = 'artifacttool';
    context.toolRunnerOptions = { env: { UNIVERSAL_AUTH_TOKEN: accessToken } };
    const operation = scenario.command === 'publish'
        ? await import('../universalPublish') : await import('../universalDownload');
    await operation.run(context);
    const expectedMessages: string[] = [];
    if (scenario.versionIncrement) {
        expectedMessages.push(format(messages.Info_UsingIncrementedVersion, version, scenario.versionIncrement, '1.2.3') + '\n');
    }
    expectedMessages.push(format(messages[scenario.command === 'publish' ? 'Info_PublishingPackage' : 'Info_DownloadingPackage'],
        scenario.packageName, version, scenario.directory) + '\n');
    if (scenario.exitCode === 0) {
        expectedMessages.push(format(messages[scenario.command === 'publish' ? 'Success_PackagesPublished' : 'Success_PackagesDownloaded'],
            scenario.packageName, version, scenario.feedName) + '\n');
    }
    assert.strictEqual(invocationCount, 1);
    assert.deepStrictEqual(displayedMessages, expectedMessages);
    assert.strictEqual(output, expectedMessages.join('').split('##vso[').join('##_vso['));
    assert.deepStrictEqual(results, [scenario.exitCode === 0 ? 'Succeeded' : 'Failed']);
    assert.deepStrictEqual(variables, scenario.command === 'publish' && scenario.exitCode === 0
        ? { packageName: scenario.packageName, packageVersion: version } : {});
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
