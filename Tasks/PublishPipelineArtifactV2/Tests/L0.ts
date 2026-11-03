import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { isValidArtifactName, normalizeJobIdentifier, parseCustomProperties, parseParallelCount } from '../helpers';

async function run(scenario: string): Promise<ttm.MockTestRunner> {
    const runner = new ttm.MockTestRunner(path.join(__dirname, scenario + '.js'));
    await runner.runAsync();
    return runner;
}

function expectFailure(runner: ttm.MockTestRunner, message: string | RegExp): void {
    if (!runner.failed) {
        console.log(runner.stdout);
        console.log(runner.stderr);
    }
    assert.ok(runner.failed, 'the task should have failed');
    const found = runner.errorIssues.concat(runner.warningIssues).some(issue => typeof message === 'string' ? issue.includes(message) : message.test(issue))
        || (typeof message === 'string' ? runner.stdout.includes(message) : message.test(runner.stdout));
    assert.ok(found, `expected a failure containing ${message}\n${runner.stdout}`);
}

function publishRequest(runner: ttm.MockTestRunner): any {
    assert.ok(runner.succeeded, `the task should have succeeded\n${runner.stdout}\n${runner.stderr}`);
    const line = runner.stdout.split(/\r?\n/).find(text => text.startsWith('PUBLISH '));
    assert.ok(line, 'the shared library should have been asked to publish');
    return JSON.parse(line!.substring('PUBLISH '.length));
}

describe('PublishPipelineArtifactV2 Suite', function () {
    this.timeout(30000);

    describe('helpers', () => {
        const loc = (key: string, ...args: any[]) => `${key}:${args.join(',')}`;

        it('validates artifact names like the agent plugin', () => {
            assert.ok(isValidArtifactName('drop'));
            assert.ok(isValidArtifactName('my artifact (1) - final.v2'));
            for (const bad of ['a/b', 'a\\b', 'a:b', 'a"b', 'a<b', 'a>b', 'a|b', 'a*b', 'a?b', 'a\u0001b']) {
                assert.ok(!isValidArtifactName(bad), bad);
            }
        });

        it('normalizes the job identifier into a default artifact name', () => {
            assert.strictEqual(normalizeJobIdentifier('Job1.default'), 'Job1');
            assert.strictEqual(normalizeJobIdentifier('Build_1.Job-2.default'), 'Build1.Job2');
            assert.strictEqual(normalizeJobIdentifier('Stage.Job.Attempt 1'), 'Stage.Job.Attempt 1');
        });

        it('parses custom properties and requires the user- prefix', () => {
            assert.strictEqual(parseCustomProperties('', loc), undefined);
            assert.deepStrictEqual(parseCustomProperties('{"user-a":"1","user-b":2,"user-c":null}', loc), { 'user-a': '1', 'user-b': '2', 'user-c': '' });
            assert.throws(() => parseCustomProperties('{"a":"1"}', loc), /ArtifactCustomPropertyInvalid:a/);
            assert.throws(() => parseCustomProperties('nope', loc), /ArtifactCustomPropertiesNotJson:nope/);
            assert.throws(() => parseCustomProperties('[1]', loc), /ArtifactCustomPropertiesNotJson/);
        });

        it('keeps the text of numbers and booleans, rejects nested values and lets a blank key pass, like the agent plugin', () => {
            assert.deepStrictEqual(
                parseCustomProperties('{"user-a":1.0,"user-b":1e3,"user-c":1.50,"user-d":-0,"user-e":12345678901234567890,"user-f":true}', loc),
                { 'user-a': '1.0', 'user-b': '1e3', 'user-c': '1.50', 'user-d': '-0', 'user-e': '12345678901234567890', 'user-f': 'true' });
            assert.throws(() => parseCustomProperties('{"user-a":{"x":1}}', loc), /ArtifactCustomPropertiesNotJson/);
            assert.throws(() => parseCustomProperties('{"user-a":[1,2]}', loc), /ArtifactCustomPropertiesNotJson/);
            assert.deepStrictEqual(parseCustomProperties('{"":"v"}', loc), { '': 'v' });
            assert.deepStrictEqual(parseCustomProperties('{"":"v","other":"w"}', loc), { '': 'v', 'other': 'w' });
            assert.throws(() => parseCustomProperties('{"other":"w","":"v"}', loc), /ArtifactCustomPropertyInvalid:other/);
        });

        it('uses the white space of .NET, not the white space of JavaScript, for blank properties and blank keys', () => {
            assert.strictEqual(parseCustomProperties(' \u0085\u2003 ', loc), undefined);
            assert.throws(() => parseCustomProperties('\ufeff', loc), /ArtifactCustomPropertiesNotJson/);
            assert.deepStrictEqual(parseCustomProperties('{"\\u0085":"v"}', loc), { '\u0085': 'v' });
            assert.throws(() => parseCustomProperties('{"\\ufeff":"v"}', loc), /ArtifactCustomPropertyInvalid/);
        });

        it('clamps the parallel count of file share copies', () => {
            const reports: string[] = [];
            assert.strictEqual(parseParallelCount('8', loc, m => reports.push(m)), 8);
            assert.strictEqual(parseParallelCount('0', loc, m => reports.push(m)), 1);
            assert.strictEqual(parseParallelCount('500', loc, m => reports.push(m)), 128);
            assert.strictEqual(reports.length, 2);
            assert.throws(() => parseParallelCount('x', loc, () => undefined), /ParallelCountNotANumber/);
            assert.throws(() => parseParallelCount(undefined, loc, () => undefined), /ParallelCountNotANumber/);
        });

        it('reads the parallel count as the agent plugin does with int.TryParse', () => {
            assert.strictEqual(parseParallelCount(' 8 ', loc, () => undefined), 8);
            assert.strictEqual(parseParallelCount('+16', loc, () => undefined), 16);
            for (const bad of ['8.0', '1e2', '0x10', '8x', '', ' ', '2147483648']) {
                assert.throws(() => parseParallelCount(bad, loc, () => undefined), /ParallelCountNotANumber/, bad);
            }
        });
    });

    describe('task', () => {
        it('fails on premises', async () => expectFailure(await run('L0OnPremFails'), /loc_mock_OnPremIsNotSupported/));
        it('fails when the server type is unknown', async () => expectFailure(await run('L0NoServerTypeFails'), /loc_mock_OnPremIsNotSupported/));
        it('fails for an invalid artifact name', async () => expectFailure(await run('L0InvalidArtifactNameFails'), /loc_mock_ArtifactNameIsNotValid bad:name/));
        it('fails when the path does not exist', async () => expectFailure(await run('L0PathDoesNotExistFails'), /loc_mock_PathDoesNotExist /));
        it('fails for custom properties that are not JSON', async () => expectFailure(await run('L0InvalidPropertiesJsonFails'), /loc_mock_ArtifactCustomPropertiesNotJson/));
        it('fails for custom properties without the user- prefix', async () => expectFailure(await run('L0PropertyPrefixFails'), /loc_mock_ArtifactCustomPropertyInvalid other/));
        it('fails outside of a build', async () => expectFailure(await run('L0NotBuildHostFails'), /loc_mock_CannotUploadFromCurrentEnvironment release/));
        it('fails for an invalid build id', async () => expectFailure(await run('L0InvalidBuildIdFails'), /loc_mock_BuildIdIsNotValid abc/));
        it('fails without a project id', async () => expectFailure(await run('L0MissingProjectIdFails'), /loc_mock_CannotBeNullOrEmpty Project ID/));
        it('fails for a project id that is not a GUID, like Guid.Parse in the agent plugin', async () => expectFailure(await run('L0InvalidProjectIdFails'), /The project id 'not-a-guid' is not a valid GUID/));

        it('names the artifact after the job when no name is given', async () => {
            const request = publishRequest(await run('L0PublishUsesJobIdentifier'));
            assert.strictEqual(request.artifactName, 'Build.Job1');
            assert.strictEqual(request.projectId, '11111111-2222-3333-4444-555555555555');
            assert.strictEqual(request.buildId, 42);
            assert.strictEqual(request.jobId, 'job-guid');
            assert.strictEqual(request.collectionUri, 'https://dev.azure.com/org/');
        });

        it('names the artifact after the job when the name is only white space of .NET', async () => {
            const request = publishRequest(await run('L0PublishUsesJobIdentifierForBlankName'));
            assert.strictEqual(request.artifactName, 'Build.Job1');
        });

        it('passes inputs, properties and knobs to the publisher', async () => {
            const request = publishRequest(await run('L0PublishWithInputs'));
            assert.strictEqual(request.artifactName, 'my artifact');
            assert.deepStrictEqual(request.properties, { 'user-a': '1', 'user-b': '2' });
            assert.strictEqual(request.domainOverride, 'domain-guid');
            assert.strictEqual(request.dedupParallelism, 12);
            assert.strictEqual(path.resolve(request.sourcePath), path.resolve(__dirname));
        });

        it('resolves a relative path against the default working directory', async () => {
            const request = publishRequest(await run('L0PublishRelativePath'));
            assert.strictEqual(path.resolve(request.sourcePath), path.resolve(__dirname));
        });

        it('rejects file share artifact names that could leave the share', async () => {
            expectFailure(await run('L0FileShareInvalidNameFails'), /loc_mock_ArtifactNameIsNotValid \.\./);
            expectFailure(await run('L0FileShareSeparatorInNameFails'), /loc_mock_ArtifactNameIsNotValid a/);
        });

        it('does not publish to a file share on Linux and macOS', async function () {
            if (process.platform === 'win32') {
                this.skip();
            }
            expectFailure(await run('L0FileShareNotSupportedOnNonWindows'), /loc_mock_FileShareOperatingSystemNotSupported/);
        });
    });
});
