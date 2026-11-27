import assert = require('assert');
import fs = require('fs');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadBuildArtifactsV2 Suite', function () {
    it('No build type provided should fail', async () => {
        const tp: string = path.join(__dirname, 'L0NoBuildTypeProvidedFail.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: buildType'));
        assert(tr.failed, 'task should have failed');
    }).timeout(10000);

    it('No download path provided should fail', async () => {
        const tp: string = path.join(__dirname, 'L0NoDownloadPathProvidedFail.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: downloadPath'));
        assert(tr.failed, 'task should have failed');
    }).timeout(10000);

    it('No download type provided should fail', async () => {
        const tp: string = path.join(__dirname, 'L0NoDownloadTypeProvidedFail.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: downloadType'));
        assert(tr.failed, 'task should have failed');
    }).timeout(10000);

    it('Tar extraction on Windows should fail fast', async function () {
        if (process.platform !== 'win32') {
            this.skip();
        }
        const tp: string = path.join(__dirname, 'L0TarExtractionOnWindowsFail.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('loc_mock_TarExtractionNotSupportedInWindows'));
    }).timeout(10000);

    it('An unknown project should fail with the message of the agent plugin', async () => {
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0UnknownProjectFail.js'));
        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('Get project failed missing-project , exception: HTTP 404'), tr.stdout);
    }).timeout(10000);

    it('The project id of the current run must be a GUID, like Guid.Parse in the agent plugin', async () => {
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0InvalidProjectIdFail.js'));
        await tr.runAsync();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained("The project id 'not-a-guid' is not a valid GUID"), tr.stdout);
    }).timeout(10000);

    it('Reads boolean inputs like bool.TryParse: white space of .NET around the word is allowed', async () => {
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0BooleanInputsLikeDotNet.js'));
        await tr.runAsync();
        assert(tr.succeeded, `task should have succeeded\n${tr.stdout}`);
        assert.strictEqual(downloadRequest(tr).params.checkDownloadedFiles, true);
    }).timeout(10000);

    it('The project of the triggering build replaces the project for the build query', async () => {
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0TriggeringProject.js'));
        await tr.runAsync();
        assert(tr.succeeded, `task should have succeeded\n${tr.stdout}`);
        assert(tr.stdOutContained('BUILDS project=bbbbbbbb-1111-1111-1111-111111111111'), tr.stdout);
        const request = downloadRequest(tr);
        assert.strictEqual(request.params.project, 'my-project');
        assert.strictEqual(request.params.pipelineId, 7);
    }).timeout(10000);

    it('Downloads all artifacts unless the download type is single, and reads the limits like int.TryParse', async () => {
        const all: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0DownloadAll.js'));
        await all.runAsync();
        assert(all.succeeded, `task should have succeeded\n${all.stdout}`);
        const allRequest = downloadRequest(all);
        assert.strictEqual(allRequest.downloadAll, true);
        assert.strictEqual(allRequest.params.parallelizationLimit, 0);
        assert.strictEqual(allRequest.params.retryDownloadCount, 4);

        const single: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0DownloadSingle.js'));
        await single.runAsync();
        assert(single.succeeded, `task should have succeeded\n${single.stdout}`);
        const singleRequest = downloadRequest(single);
        assert.strictEqual(singleRequest.downloadAll, false);
        assert.strictEqual(singleRequest.params.artifactName, 'drop');
        assert.strictEqual(singleRequest.params.parallelizationLimit, 3);
        assert.strictEqual(singleRequest.params.retryDownloadCount, 2);
    }).timeout(20000);

    it('Passes the worker thread setting to the providers (unset by default, 0 turns the threads off) and closes the threads at the end', async () => {
        const contextOf = (runner: ttm.MockTestRunner) => {
            const line = runner.stdout.split(/\r?\n/).find(text => text.startsWith('CONTEXT '));
            assert(line, `the provider should have been created\n${runner.stdout}`);
            return JSON.parse(line!.substring('CONTEXT '.length));
        };
        const expectations: Array<[string, number | undefined]> = [
            ['L0DownloadSingle.js', undefined],
            ['L0WorkerThreadsZero.js', 0],
            ['L0WorkerThreadsCount.js', 3],
            ['L0WorkerThreadsInvalid.js', undefined]
        ];
        for (const [scenario, expected] of expectations) {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, scenario));
            await runner.runAsync();
            assert(runner.succeeded, `${scenario} should have succeeded\n${runner.stdout}`);
            assert.strictEqual(contextOf(runner).workerThreads, expected, scenario);
            assert(runner.stdOutContained('POOL CLOSED'), `${scenario} should close the worker threads\n${runner.stdout}`);
        }
    }).timeout(60000);

    it('Passes the setting whether the worker threads download to the providers (unset by default, true and false turn it on and off)', async () => {
        const contextOf = (runner: ttm.MockTestRunner) => {
            const line = runner.stdout.split(/\r?\n/).find(text => text.startsWith('CONTEXT '));
            assert(line, `the provider should have been created\n${runner.stdout}`);
            return JSON.parse(line!.substring('CONTEXT '.length));
        };
        const expectations: Array<[string, boolean | undefined]> = [
            ['L0DownloadSingle.js', undefined],
            ['L0WorkerDownloadsOn.js', true],
            ['L0WorkerDownloadsOff.js', false],
            ['L0WorkerDownloadsInvalid.js', undefined]
        ];
        for (const [scenario, expected] of expectations) {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, scenario));
            await runner.runAsync();
            assert(runner.succeeded, `${scenario} should have succeeded\n${runner.stdout}`);
            assert.strictEqual(contextOf(runner).workerDownloads, expected, scenario);
        }
    }).timeout(60000);

    it('Neutralizes ##vso[ in the lines that it logs for names that come from an artifact', async () => {
        const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0LogInjection.js'));
        await runner.runAsync();
        assert(runner.succeeded, `task should have succeeded\n${runner.stdout}`);
        const lines = runner.stdout.split(/\r?\n/);
        assert(!lines.some(line => line.startsWith('##vso[task.setvariable variable=INJECTED')), `a line of the artifact must not run as a command\n${runner.stdout}`);
        assert(lines.includes('##_vso[task.setvariable variable=INJECTED]yes'), `the line is still logged, neutralized\n${runner.stdout}`);
    }).timeout(10000);

    it('Validates the links of extracted tar archives only with the EnableTarSymlinkValidation pipeline feature, and only when archives are extracted', async () => {
        const expectations: Array<[string, boolean]> = [
            ['L0TarSymlinkValidationOn.js', true],
            ['L0TarSymlinkValidationOff.js', false],
            ['L0TarSymlinkValidationNoTars.js', false]
        ];
        for (const [scenario, expected] of expectations) {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, scenario));
            await runner.runAsync();
            assert(runner.succeeded, `${scenario} should have succeeded\n${runner.stdout}`);
            assert.strictEqual(downloadRequest(runner).params.validateTarSymlinks, expected, scenario);
        }
    }).timeout(30000);

    it('Refuses the name of a single artifact that cannot be a folder name, before it asks a service or touches the destination', async () => {
        const run = async (name: string): Promise<ttm.MockTestRunner> => {
            process.env['ARTIFACT_NAME_UNDER_TEST'] = name;
            try {
                const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0ArtifactNameSingle.js'));
                await runner.runAsync();
                return runner;
            } finally {
                delete process.env['ARTIFACT_NAME_UNDER_TEST'];
            }
        };
        for (const name of ['', '..', ' . . ', '../outside', 'a/b', 'a:b', 'a*b']) {
            const runner = await run(name);
            assert(runner.failed, `"${name}" should have failed\n${runner.stdout}`);
            assert(runner.stdOutContained('loc_mock_ArtifactNameIsNotValidWithStrictValidation'), `"${name}"\n${runner.stdout}`);
            assert(!runner.stdout.includes('DOWNLOAD '), `nothing is downloaded for "${name}"`);
            assert(!runner.stdout.includes('loc_mock_DownloadingFromBuild'), `no build is looked up for "${name}"`);
        }
        for (const name of ['drop', 'release-1.2', '.build', 'my artifact']) {
            const runner = await run(name);
            assert(runner.succeeded, `"${name}" should have succeeded\n${runner.stdout}`);
            assert.strictEqual(downloadRequest(runner).params.artifactName, name);
        }
    }).timeout(120000);

    it('Matches the patterns without regard to case only with the CaseInsensitiveArtifactMatchingFixEnabled pipeline feature, and only where the file system ignores case', async () => {
        const nocaseOf = async (scenario: string): Promise<boolean> => {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, scenario));
            await runner.runAsync();
            assert(runner.succeeded, `${scenario} should have succeeded\n${runner.stdout}`);
            const options = downloadRequest(runner).params.customMinimatchOptions;
            assert.strictEqual(options.dot, true, scenario);
            assert.strictEqual(options.nobrace, true, scenario);
            return options.nocase;
        };
        assert.strictEqual(await nocaseOf('L0CaseMatchingOff.js'), false, 'without the feature the case matters');
        const on = await nocaseOf('L0CaseMatchingOn.js');
        if (process.platform === 'win32') {
            assert.strictEqual(on, true, 'Windows ignores case');
        } else if (process.platform === 'linux') {
            assert.strictEqual(on, false, 'Linux does not ignore case');
        } else {
            assert.strictEqual(typeof on, 'boolean', 'macOS depends on the file system of the destination');
        }
    }).timeout(30000);

    it('Skips the artifacts of the build whose name is invalid, fails the task in the end, and does not publish the names', async () => {
        const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0ArtifactNameAll.js'));
        await runner.runAsync();
        assert(runner.failed, `the task should have failed\n${runner.stdout}`);
        for (const name of ['../outside', 'a:b']) {
            assert(runner.stdOutContained(`loc_mock_ArtifactNameIsNotValidWithStrictValidation ${name}`), `the name "${name}" is reported\n${runner.stdout}`);
        }
        assert(runner.stdout.includes('DOWNLOAD '), `the other artifacts are still downloaded\n${runner.stdout}`);

        const eventLine = runner.stdout.split(/\r?\n/).find(text => text.startsWith('##vso[telemetry.publish area=DownloadBuildArtifacts;feature=download;]'));
        assert(eventLine, `the event is published\n${runner.stdout}`);
        const event = JSON.parse(eventLine!.substring(eventLine!.indexOf(']') + 1));
        assert.strictEqual(event.result, 'failed');
        assert.strictEqual(event.invalidArtifactNames, 3);
        for (const name of ['outside', 'a:b']) {
            assert(!eventLine!.includes(name), `the event should not hold '${name}'`);
        }
    }).timeout(10000);

    describe('Telemetry', function () {
        const prefix = '##vso[telemetry.publish area=DownloadBuildArtifacts;feature=download;]';
        const eventLineOf = (runner: ttm.MockTestRunner): string => {
            const lines = runner.stdout.split(/\r?\n/).filter(text => text.startsWith(prefix));
            assert.strictEqual(lines.length, 1, `exactly one telemetry event should have been published\n${runner.stdout}`);
            return lines[0];
        };
        const eventOf = (runner: ttm.MockTestRunner): any => JSON.parse(eventLineOf(runner).substring(prefix.length));

        it('Publishes how the run went and was set up with the counters of the download, and nothing that a user typed', async () => {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0TelemetrySuccess.js'));
            await runner.runAsync();
            assert(runner.succeeded, `task should have succeeded\n${runner.stdout}`);
            const event = eventOf(runner);
            assert.strictEqual(event.result, 'succeeded');
            assert.strictEqual(typeof event.durationMs, 'number');
            assert(/^\d+\.\d+\.\d+$/.test(event.taskVersion), `taskVersion: ${event.taskVersion}`);
            assert(/^v\d+\.\d+\.\d+/.test(event.nodeVersion), `nodeVersion: ${event.nodeVersion}`);
            assert.deepStrictEqual(
                [event.hostType, event.agentVersion, event.agentOS, event.agentArchitecture, event.jobId, event.planId],
                ['build', '4.248.0', 'Linux', 'X64', '11111111-aaaa-bbbb-cccc-222222222222', '33333333-dddd-eeee-ffff-444444444444']);
            assert.deepStrictEqual(
                [event.buildType, event.downloadType, event.buildVersionToDownload],
                ['current', 'single', 'other']);
            assert.deepStrictEqual(
                [event.specificBuildWithTriggering, event.cleanDestinationFolder, event.extractTars, event.checkDownloadedFiles, event.hasItemPattern],
                [false, false, false, true, true]);
            assert.deepStrictEqual(
                [event.parallelizationLimit, event.retryDownloadCount, event.workerThreadsSetting, event.workerDownloadsSetting],
                [5, 2, 2, true]);
            assert.deepStrictEqual([event.files, event.bytes], [3, 1234], 'the counters of the download are part of the event');
            assert(!('errorType' in event), 'a run that succeeded has no error');

            const line = eventLineOf(runner);
            for (const typed of ['my-private-artifact', 'private-folder', '.pem', 'somebody typed', __dirname, JSON.stringify(__dirname).slice(1, -1)]) {
                assert(!line.includes(typed), `the event should not hold '${typed}'\n${line}`);
            }
        }).timeout(10000);

        it('Publishes the kind, the HTTP status and the system code of a failure, and never its message', async () => {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0TelemetryFailure.js'));
            await runner.runAsync();
            assert(runner.failed, 'task should have failed');
            assert(runner.stdOutContained('private.example.com'), 'the user still sees the message of the error');
            const event = eventOf(runner);
            assert.strictEqual(event.result, 'failed');
            assert.deepStrictEqual([event.errorType, event.errorStatus, event.errorCode], ['HttpError', 503, 'ECONNRESET']);

            const line = eventLineOf(runner);
            for (const message of ['private.example.com', 'secret-artifact', 'private', 'file.txt']) {
                assert(!line.includes(message), `the event should not hold '${message}'\n${line}`);
            }
        }).timeout(10000);

        it('Publishes only the kind of an error that has no status and no code', async () => {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0NoBuildTypeProvidedFail.js'));
            await runner.runAsync();
            assert(runner.failed, 'task should have failed');
            const event = eventOf(runner);
            assert.strictEqual(event.result, 'failed');
            assert.strictEqual(event.errorType, 'Error');
            assert(!('errorStatus' in event) && !('errorCode' in event), 'there is no status and no code to publish');
            assert(!eventLineOf(runner).includes('Input required'), 'the message of the error is not published');
        }).timeout(10000);

        it('Publishes nothing that an error says about itself unless it is a known kind, status or code', async () => {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0TelemetryCustomError.js'));
            await runner.runAsync();
            assert(runner.failed, 'task should have failed');
            const event = eventOf(runner);
            assert.strictEqual(event.result, 'failed');
            assert.strictEqual(event.errorType, 'Unknown', 'neither the class nor the name of the error is one that is known');
            assert(!('errorStatus' in event) && !('errorCode' in event), 'neither the status nor the code is one that is known');

            const line = eventLineOf(runner);
            for (const text of ['MY_PRIVATE_ARTIFACT', 'PrivateArtifactError', 'SECRET_TOKEN_123', 'secret message']) {
                assert(!line.includes(text), `the event should not hold '${text}'\n${line}`);
            }
        }).timeout(10000);

        it('Publishes a value of the environment only when it has the form that the agent gives it', async () => {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0TelemetryUntrusted.js'));
            await runner.runAsync();
            assert(runner.succeeded, `task should have succeeded\n${runner.stdout}`);
            const event = eventOf(runner);
            assert.deepStrictEqual(
                [event.hostType, event.agentOS, event.agentArchitecture],
                ['other', 'other', 'other']);
            for (const name of ['agentVersion', 'jobId', 'planId']) {
                assert(!(name in event), `${name} is not published when it is not in the form of the agent`);
            }

            const line = eventLineOf(runner);
            for (const text of ['my private host', 'not a guid', 'ppppp', '1.2.3-private-build', 'PrivateOS', 'private']) {
                assert(!line.includes(text), `the event should not hold '${text}'\n${line}`);
            }
        }).timeout(10000);

        it('A failure to publish does not change the result of a task that succeeds', async () => {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0TelemetryBroken.js'));
            await runner.runAsync();
            assert(runner.succeeded, `task should have succeeded\n${runner.stdout}`);
            assert(!runner.stdout.includes(prefix), 'no event should have been published');
            assert(runner.stdOutContained('The telemetry was not published: the counters are broken'), runner.stdout);
        }).timeout(10000);

        it('A failure to publish does not change the result or the message of a task that fails', async () => {
            const runner: ttm.MockTestRunner = new ttm.MockTestRunner(path.join(__dirname, 'L0TelemetryBrokenFailure.js'));
            await runner.runAsync();
            assert(runner.failed, 'task should have failed');
            assert(!runner.stdout.includes(prefix), 'no event should have been published');
            assert(runner.stdOutContained('The telemetry was not published: the counters are broken'), runner.stdout);
            assert(/^##vso\[task\.issue type=error;.*\]GET https:\/\/private\.example\.com\/secret-artifact failed/m.test(runner.stdout), `the user still sees the error\n${runner.stdout}`);
        }).timeout(10000);
    });
});

function downloadRequest(runner: ttm.MockTestRunner): any {
    const line = runner.stdout.split(/\r?\n/).find(text => text.startsWith('DOWNLOAD '));
    assert(line, `the download code should have been asked to download\n${runner.stdout}`);
    return JSON.parse(line!.substring('DOWNLOAD '.length));
}

// The unit tests of the download code in Tests/unit run in this mocha run too, because the build runs only this file.
describe('DownloadEngine unit tests', function () {
    this.timeout(60000);
    const unitTests = path.join(__dirname, 'unit');
    for (const file of fs.readdirSync(unitTests).filter(name => name.endsWith('.test.js')).sort()) {
        require(path.join(unitTests, file));
    }
});
