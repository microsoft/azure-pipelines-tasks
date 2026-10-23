import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import * as http from 'http';
import * as stream from 'stream';
import { AddressInfo } from 'net';
import * as tl from 'azure-pipelines-task-lib/task';
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import { ArtifactEngineOptions } from 'artifact-engine/Engine/artifactEngineOptions';
import { HttpClient } from 'artifact-engine/Providers/typed-rest-client/HttpClient';
import * as Q from 'q';

import { JenkinsOutput } from '../JenkinsOutput';
import { JenkinsRestClient } from '../ArtifactDetails/JenkinsRestClient';
import { CommitsDownloader } from '../ArtifactDetails/CommitsDownloader';

export async function getDownloaderOptions(pattern: string, flag?: string, parallel = '6', debug = 'true'): Promise<ArtifactEngineOptions> {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jenkins-task-'));
    const environment = {
        // ARM import requires this; task-lib's vault key must be private to each child.
        AGENT_TEMPDIRECTORY: temporaryDirectory,
        DISTRIBUTEDTASK_TASKS_ENABLEVSOCOMMANDBLOCKINGRMTASKS: flag,
        // Oppose the RM flag to verify that the retired flag no longer controls blocking.
        DISTRIBUTEDTASK_TASKS_JENKINSDOWNLOADARTIFACTSVSOCOMMANDBLOCKINGFIXENABLED: flag === 'true' ? 'false' : 'true',
        JENKINS_TEST_PATTERN: pattern,
        JENKINS_TEST_PARALLEL: parallel,
        JENKINS_TEST_DEBUG: debug
    };
    const previous: { [name: string]: string } = {};
    Object.keys(environment).forEach(name => {
        previous[name] = process.env[name];
        if (environment[name] === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = environment[name];
        }
    });
    try {
        const runner = new MockTestRunner(path.join(__dirname, 'CommandBlockingTask.js'));
        // Use the suite's runtime without downloading a second Node version.
        runner.nodePath = process.execPath;
        await runner.runAsync();
        assert.strictEqual(runner.failed, false, runner.stdout + runner.stderr);
        assert(runner.stdOutContained('ArtifactSuccessfullyDownloaded'), runner.stdout);
        const captures = runner.stdout.split(/\r?\n/).filter(line => line.indexOf('JENKINS_DOWNLOADER_OPTIONS=') === 0);
        assert.strictEqual(captures.length, 1, runner.stdout);
        const captured: { provider: string; options: ArtifactEngineOptions } =
            JSON.parse(captures[0].substring('JENKINS_DOWNLOADER_OPTIONS='.length));
        assert.strictEqual(captured.provider, pattern === '**' ? 'ZipProvider' : 'WebProvider');
        return Object.assign(new ArtifactEngineOptions(), captured.options);
    } finally {
        Object.keys(environment).forEach(name => {
            if (previous[name] === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = previous[name];
            }
        });
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}

describe('Jenkins downloader command modes', function () {
    this.timeout(30000);
    for (const pattern of ['drop/**/*.txt\n!drop/skip.txt', '**']) {
        for (const flag of [undefined, 'false', 'true']) {
            it(`passes ${flag || 'absent'} flag options to the ${pattern === '**' ? 'ZIP' : 'per-file'} engine`, async () => {
                const options = await getDownloaderOptions(pattern, flag);
                assert.strictEqual(options.vsoCommandMode, flag === 'true' ? 'blockAndTelemetry' : 'telemetryOnly');
                assert.strictEqual(options.itemPattern, pattern);
                assert.strictEqual(options.parallelProcessingLimit, 6);
                assert.strictEqual(options.verbose, true);
            });
        }
        it(`preserves default parallelism and disabled verbose output for ${pattern}`, async () => {
            const options = await getDownloaderOptions(pattern, 'true', '0', 'false');
            assert.strictEqual(options.parallelProcessingLimit, 4);
            assert.strictEqual(options.verbose, false);
        });
    }
});

describe('Jenkins external output filtering', function () {
    this.timeout(10000);
    const feature = 'DISTRIBUTEDTASK_TASKS_ENABLEVSOCOMMANDBLOCKINGRMTASKS';
    const message = 'job\n##vso[task.setvariable variable=PATH]untrusted\n##VsO[task.complete result=Succeeded;]untrusted';
    let originalFeature: string;
    let originalWriter: typeof tl.writeExternalOutput;
    let originalLoc: typeof tl.loc;
    let output: string;
    let taskOutput: string;

    beforeEach(() => {
        originalFeature = process.env[feature];
        originalWriter = tl.writeExternalOutput;
        originalLoc = tl.loc;
        output = taskOutput = '';
        const destination = new stream.Writable({
            write(chunk, encoding, callback) { output += chunk.toString(); callback(); }
        });
        tl.setStdStream(new stream.Writable({
            write(chunk, encoding, callback) { taskOutput += chunk.toString(); callback(); }
        }));
        Object.assign(tl, {
            loc: (key: string, ...args: string[]) => [key, ...args].join(' '),
            writeExternalOutput: (message: string | Buffer, options: tl.ExternalOutputOptions) =>
                originalWriter(message, { ...options, destination })
        });
    });

    afterEach(() => {
        if (originalFeature === undefined) {
            delete process.env[feature];
        } else {
            process.env[feature] = originalFeature;
        }
        Object.assign(tl, { writeExternalOutput: originalWriter, loc: originalLoc });
        tl.setStdStream(process.stdout);
    });

    for (const featureValue of [undefined, 'false', 'true']) {
        it(`filters remote logs and job types with flag=${featureValue} without changing returned values`, async () => {
            if (featureValue === undefined) {
                delete process.env[feature];
            } else {
                process.env[feature] = featureValue;
            }
            JenkinsOutput.initialize();
            const client = new JenkinsRestClient();
            client.DownloadJsonContent = () => Q.resolve(message);
            assert.strictEqual(await client.GetJobType(), message);
            const blocked = featureValue === 'true';
            const expected = blocked ? message.replace(/##vso\[/g, '##_vso[') : message;
            assert.strictEqual(output, 'FoundJobType ' + expected + '\n');
            const events = taskOutput.split('\n').filter(line => line.includes('telemetry.publish'));
            assert(events.some(line => line.includes(`"source":"remote","commandName":"task.setvariable","blocked":${blocked}`)));
            assert(events.every(line => !line.includes('untrusted')));
        });

        for (const status of [200, 500]) {
            it(`filters API response diagnostics with flag=${featureValue}, HTTP=${status}`, async () => {
                if (featureValue === undefined) {
                    delete process.env[feature];
                } else {
                    process.env[feature] = featureValue;
                }
                JenkinsOutput.initialize();
                const responseBody = status === 200 ? JSON.stringify({ name: message }) : message;
                const server = http.createServer((request, response) => {
                    response.writeHead(status, { Connection: 'close' });
                    response.end(responseBody);
                });
                await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
                const httpClient = new HttpClient('JenkinsOutputTest');
                try {
                    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/json`;
                    const result = new JenkinsRestClient().DownloadJsonContentWithRetries(httpClient, url, null, null);
                    if (status === 200) {
                        assert.deepStrictEqual(await result, { name: message });
                    } else {
                        await assert.rejects(Promise.resolve(result), /ServerCallFailed/);
                    }
                    const blocked = featureValue === 'true';
                    assert(taskOutput.includes(blocked ? '##_vso[task.setvariable' : '##vso[task.setvariable'));
                    assert(taskOutput.includes(`"commandName":"task.setvariable","blocked":${blocked}`));
                } finally {
                    httpClient.dispose();
                    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
                }
            });
        }
    }

    it('filters commit parsing failures while preserving the failure', () => {
        process.env[feature] = 'true';
        JenkinsOutput.initialize();
        assert.throws(() => CommitsDownloader.GetCommitMessagesFromCommits(message));
        assert(output.includes('##_vso[task.setvariable'));
        assert(!output.includes('##vso['));
    });

    it('preserves ordinary messages without emitting command telemetry', () => {
        process.env[feature] = 'true';
        JenkinsOutput.initialize();
        JenkinsOutput.log('Downloaded artifacts');
        assert.strictEqual(output, 'Downloaded artifacts\n');
        assert(!taskOutput.includes('telemetry.publish'));
    });

    it('reads the feature once and reuses options for logging and downloader configuration', () => {
        const originalGetPipelineFeature = tl.getPipelineFeature;
        let featureReads = 0;
        Object.assign(tl, {
            getPipelineFeature: (name: string) => {
                if (name === 'EnableVsoCommandBlockingRMTasks') {
                    featureReads++;
                }
                return originalGetPipelineFeature(name);
            }
        });
        try {
            process.env[feature] = 'true';
            JenkinsOutput.initialize();
            const options = JenkinsOutput.options;
            JenkinsOutput.log('Downloaded artifacts');
            JenkinsOutput.debug('Download details');
            assert.strictEqual(JenkinsOutput.options, options);
            assert.strictEqual(options.vsoCommandMode, 'blockAndTelemetry');
            assert.strictEqual(featureReads, 1);
        } finally {
            Object.assign(tl, { getPipelineFeature: originalGetPipelineFeature });
        }
    });
});
