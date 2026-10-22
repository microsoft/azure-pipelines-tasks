import * as assert from 'assert';
import * as http from 'http';
import * as stream from 'stream';
import { AddressInfo } from 'net';

import * as tl from 'azure-pipelines-task-lib/task';
import { HttpClient } from 'typed-rest-client/HttpClient';
import * as Q from 'q';

import { JenkinsOutput } from '../JenkinsOutput';
import { JenkinsRestClient } from '../ArtifactDetails/JenkinsRestClient';
import { CommitsDownloader } from '../ArtifactDetails/CommitsDownloader';

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
        assert.throws(() => CommitsDownloader.GetCommitMessagesFromCommits(message));
        assert(output.includes('##_vso[task.setvariable'));
        assert(!output.includes('##vso['));
    });

    it('preserves ordinary messages without emitting command telemetry', () => {
        process.env[feature] = 'true';
        JenkinsOutput.log('Downloaded artifacts');
        assert.strictEqual(output, 'Downloaded artifacts\n');
        assert(!taskOutput.includes('telemetry.publish'));
    });
});
