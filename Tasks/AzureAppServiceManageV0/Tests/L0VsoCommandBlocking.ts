import * as assert from 'assert';
import * as stream from 'stream';

import * as tl from 'azure-pipelines-task-lib/task';
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu';

import { KuduServiceUtils } from '../operations/KuduServiceUtils';

describe('Kudu external output filtering', () => {
    const feature = 'DISTRIBUTEDTASK_TASKS_ENABLEVSOCOMMANDBLOCKINGRMTASKS';
    const name = 'job\n##vso[task.setvariable variable=PATH]untrusted\n##vso[task.complete result=Succeeded;]untrusted';
    let originalFeature: string;
    let originalWriter: typeof tl.writeExternalOutput;
    let originalLoc: typeof tl.loc;
    let output: string;
    let telemetry: string;

    beforeEach(() => {
        originalFeature = process.env[feature];
        originalWriter = tl.writeExternalOutput;
        originalLoc = tl.loc;
        output = telemetry = '';
        const destination = new stream.Writable({
            write(chunk, encoding, callback) { output += chunk.toString(); callback(); }
        });
        tl.setStdStream(new stream.Writable({
            write(chunk, encoding, callback) { telemetry += chunk.toString(); callback(); }
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
        for (const action of ['start', 'stop']) {
            it(`filters ${action} WebJob names with flag=${featureValue} without modifying API arguments`, async () => {
                if (featureValue === undefined) {
                    delete process.env[feature];
                } else {
                    process.env[feature] = featureValue;
                }
                const calls: string[] = [];
                const kudu = new Kudu('https://example.invalid', 'Basic test');
                Object.assign(kudu, {
                    getContinuousJobs: async () => [
                        { name, status: action === 'start' ? 'running' : 'stopped' },
                        { name, status: action === 'start' ? 'stopped' : 'running' }
                    ],
                    startContinuousWebJob: async (jobName: string) => { calls.push(jobName); },
                    stopContinuousWebJob: async (jobName: string) => { calls.push(jobName); }
                });
                const utils = new KuduServiceUtils(kudu);
                if (action === 'start') {
                    await utils.startContinuousWebJobs();
                } else {
                    await utils.stopContinuousWebJobs();
                }
                const blocked = featureValue === 'true';
                assert(output.includes(blocked ? name.replace(/##vso\[/g, '##_vso[') : name));
                assert.deepStrictEqual(calls, [name]);
                assert(telemetry.includes(`"source":"remote","commandName":"task.setvariable","blocked":${blocked}`));
                assert(!telemetry.includes('untrusted'));
            });
        }
    }

    it('continues to propagate Kudu failures', async () => {
        const kudu = new Kudu('https://example.invalid', 'Basic test');
        kudu.getContinuousJobs = async () => { throw new Error('Kudu unavailable'); };
        await assert.rejects(new KuduServiceUtils(kudu).startContinuousWebJobs(), /Kudu unavailable/);
    });
});
