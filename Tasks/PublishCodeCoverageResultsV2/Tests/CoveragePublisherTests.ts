import * as assert from 'assert';
import * as path from 'path';
import * as mocker from 'azure-pipelines-task-lib/lib-mocker';
import { ExternalOutputOptions } from 'azure-pipelines-task-lib/externaloutput';
import { createExternalOutputStream } from 'azure-pipelines-task-lib/task';
import { IExecOptions, ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { Writable } from 'stream';

describe('Coverage publisher containment launch', function () {
    let publisher: typeof import('coveragepublisher/coveragepublisher');
    let args: string[];
    let options: IExecOptions;
    let failures: string[];
    let checkedDirectories: string[];
    let resourcePaths: string[];
    let directoryExists: boolean;
    let isDirectory: boolean;
    let execError: Error;
    let finishExecution: () => void;
    let execution: Promise<number>;
    let stdoutChunks: Buffer[];
    let stderrChunks: Buffer[];
    let externalOutputStreams: {
        source: string;
        destination: NodeJS.WritableStream;
        output: Buffer[];
        ended: boolean;
        stream: NodeJS.WritableStream;
    }[];
    const workspace = path.join(process.cwd(), 'workspace with spaces') + path.sep;
    const sources = path.join(process.cwd(), 'external sources');

    beforeEach(async function () {
        args = [];
        options = undefined;
        failures = [];
        checkedDirectories = [];
        resourcePaths = [];
        directoryExists = true;
        isDirectory = true;
        execError = undefined;
        stdoutChunks = undefined;
        stderrChunks = undefined;
        externalOutputStreams = [];
        execution = new Promise<number>(resolve => {
            finishExecution = () => resolve(0);
        });

        mocker.enable({ useCleanCache: true, warnOnUnregistered: false });
        mocker.registerMock('azure-pipelines-task-lib/task', {
            assertAgent: () => {},
            getVariable: (name: string) => name === 'Agent.TempDirectory' ? process.cwd() : undefined,
            getEndpointAuthorizationParameter: () => '',
            which: () => 'dotnet',
            debug: () => {},
            setResourcePath: (resourcePath: string) => resourcePaths.push(resourcePath),
            createExternalOutputStream: (externalOutputOptions: ExternalOutputOptions & {
                destination: NodeJS.WritableStream;
            }) => {
                const externalOutputStream = {
                    ...externalOutputOptions,
                    output: [] as Buffer[],
                    ended: false,
                    stream: undefined as NodeJS.WritableStream
                };
                const filteredStream = createExternalOutputStream({
                    source: externalOutputOptions.source,
                    destination: new Writable({
                        write: (data: Buffer, encoding: string, callback: () => void) => {
                            externalOutputStream.output.push(data);
                            callback();
                        }
                    })
                });
                externalOutputStream.stream = {
                    write: (data: Buffer) => filteredStream.write(data),
                    end: () => {
                        externalOutputStream.ended = true;
                        filteredStream.end();
                    }
                } as NodeJS.WritableStream;
                externalOutputStreams.push(externalOutputStream);
                return externalOutputStream.stream;
            },
            loc: (key: string, ...values: string[]) => {
                assert.strictEqual(path.basename(resourcePaths[0]), 'module.json');
                return [key, ...values].join(': ');
            },
            TaskResult: { Failed: 2 },
            setResult: (result: number, message: string) => failures.push(message),
            tool: () => ({
                arg: (value: string) => args.push(value),
                exec: (value: IExecOptions) => {
                    options = value;
                    for (const data of stdoutChunks || []) {
                        options.outStream.write(data);
                    }
                    for (const data of stderrChunks || []) {
                        options.errStream.write(data);
                    }
                    return execError ? Promise.reject(execError) : execution;
                }
            })
        });
        mocker.registerMock('fs', {
            mkdirSync: () => {},
            existsSync: (directory: string) => {
                checkedDirectories.push(directory);
                return directoryExists;
            },
            statSync: () => ({ isDirectory: () => isDirectory })
        });
        mocker.registerMock('uuid/v4', () => 'report');
        mocker.registerMock('child_process', { execSync: () => {} });
        publisher = await import('coveragepublisher/coveragepublisher');
    });

    afterEach(function () {
        finishExecution();
        mocker.disable();
        mocker.deregisterAll();
    });

    it('validates the workspace and enables quoting without splitting paths', async function () {
        finishExecution();
        await publisher.PublishCodeCoverage(['coverage.xml'], sources, true, [workspace], true);

        assert.deepStrictEqual(checkedDirectories, [workspace]);
        assert.strictEqual(options.cwd, workspace);
        assert.strictEqual(options.windowsVerbatimArguments, false);
        assert.strictEqual(args[args.indexOf('--trustedSourceDirectory') + 1], `${workspace};${sources}`);
        assert.strictEqual(args[args.indexOf('--sourceDirectory') + 1], sources);
        assert.strictEqual(options.env.AZP_COVERAGE_TRUSTED_SOURCE_DIRECTORIES, `${workspace};${sources}`);
        assert(args.includes('--enableTrustedSourcePathFiltering'));
    });

    it('preserves complete arguments when launching a real child process', async function () {
        finishExecution();
        await publisher.PublishCodeCoverage(['coverage.xml'], sources, true, [workspace], true);

        const runner = new ToolRunner(process.execPath);
        runner.arg(['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', '--', ...args]);
        let output = '';
        runner.on('stdout', (data: Buffer) => { output += data.toString(); });
        await runner.exec({ silent: true, windowsVerbatimArguments: options.windowsVerbatimArguments });

        assert.deepStrictEqual(JSON.parse(output), args);
    });

    for (const containmentEnabled of [false, true]) {
        it(`blocks split logging commands with containment ${containmentEnabled ? 'on' : 'off'}`, async function () {
            stdoutChunks = [
                Buffer.from('coverage ##v'),
                Buffer.from('so[task.setvariable variable=PATH]untrusted\n##'),
                Buffer.from('vso[task.prependpath]untrusted\nfinished ##')
            ];
            stderrChunks = [
                Buffer.from('error #'),
                Buffer.from('#vso[task.setvariable variable=NODE_OPTIONS]untrusted\n')
            ];
            finishExecution();
            await publisher.PublishCodeCoverage(['coverage.xml'], sources, true, [workspace], containmentEnabled, true);
            await new Promise<void>(resolve => setImmediate(resolve));

            assert.strictEqual(externalOutputStreams.length, 2);
            assert.strictEqual(externalOutputStreams[0].source, 'repository');
            assert.strictEqual(externalOutputStreams[0].destination, process.stdout);
            assert.strictEqual(options.outStream, externalOutputStreams[0].stream);
            assert.strictEqual(externalOutputStreams[1].source, 'repository');
            assert.strictEqual(externalOutputStreams[1].destination, process.stderr);
            assert.strictEqual(
                Buffer.concat(externalOutputStreams[0].output).toString(),
                'coverage ##_vso[task.setvariable variable=PATH]untrusted\n##_vso[task.prependpath]untrusted\nfinished ##');
            assert.strictEqual(
                Buffer.concat(externalOutputStreams[1].output).toString(),
                'error ##_vso[task.setvariable variable=NODE_OPTIONS]untrusted\n');
            assert(externalOutputStreams.every(stream => stream.ended), 'filters must flush trailing bytes');
            assert(failures.length > 0, 'stderr must still fail the task');
        });
    }

    for (const { filteringEnabled, containmentEnabled } of [
        { filteringEnabled: undefined, containmentEnabled: false },
        { filteringEnabled: false, containmentEnabled: true }
    ]) {
        it(`preserves legacy output with filtering ${filteringEnabled === undefined ? 'unset' : 'off'} and containment ${containmentEnabled}`, async function () {
            const stderrMessages: string[] = [];
            const originalConsoleError = console.error;
            console.error = (message: string) => { stderrMessages.push(message); };
            try {
                stderrChunks = [Buffer.from('publisher diagnostic')];
                finishExecution();
                await publisher.PublishCodeCoverage(['coverage.xml'], sources, true, [workspace], containmentEnabled, filteringEnabled);

                assert.strictEqual(externalOutputStreams.length, 0, 'disabled filtering must not create filter streams');
                assert.strictEqual(options.outStream, process.stdout, 'stdout should use the legacy destination');
                assert.deepStrictEqual(stderrMessages, ['publisher diagnostic']);
                assert.deepStrictEqual(failures, [undefined], 'stderr must still fail the task');
                assert.strictEqual(options.ignoreReturnCode, false);
                assert.strictEqual(options.failOnStdErr, true);
            } finally {
                console.error = originalConsoleError;
            }
        });
    }

    it('preserves execution failure and flushes active filters', async function () {
        stdoutChunks = [Buffer.from('publisher trailing ##')];
        execError = new Error('publisher exited with code 1');
        await publisher.PublishCodeCoverage(['coverage.xml'], sources, true, [workspace], true, true);
        await new Promise<void>(resolve => setImmediate(resolve));

        assert.deepStrictEqual(failures, ['CoveragePublisherExecutionFailed: publisher exited with code 1']);
        assert.strictEqual(externalOutputStreams.length, 2);
        assert(externalOutputStreams.every(stream => stream.ended), 'failure must still close the filters');
        assert.strictEqual(
            Buffer.concat(externalOutputStreams[0].output).toString(),
            'publisher trailing ##',
            'failure must not lose buffered trailing text');
    });

    for (const missing of [true, false]) {
        it(`rejects a workspace that ${missing ? 'does not exist' : 'is a file'}`, async function () {
            directoryExists = !missing;
            isDirectory = false;
            await assert.rejects(
                publisher.PublishCodeCoverage(['coverage.xml'], undefined, true, [workspace], true),
                /InvalidCoverageWorkingDirectory/);
            assert.strictEqual(options, undefined, 'publisher must not be launched');
        });
    }

    for (const roots of [[], [' ', '\t']]) {
        it(`rejects ${roots.length ? 'whitespace-only' : 'missing'} trusted roots`, async function () {
            await assert.rejects(
                publisher.PublishCodeCoverage(['coverage.xml'], ' ', true, roots, true),
                /NoTrustedCoverageSourceDirectories/);
            assert.strictEqual(options, undefined, 'publisher must not be launched');
        });
    }

    it('accepts pathToSources alone without trusting the working directory', async function () {
        finishExecution();
        await publisher.PublishCodeCoverage(['coverage.xml'], sources, true, [' ', '\t'], true);

        assert.strictEqual(options.cwd, process.cwd());
        assert.strictEqual(options.env.AZP_COVERAGE_TRUSTED_SOURCE_DIRECTORIES, sources);
    });

    it('skips blank workspace values when selecting the working directory', async function () {
        finishExecution();
        await publisher.PublishCodeCoverage(['coverage.xml'], undefined, true, [' ', workspace], true);
        assert.strictEqual(options.cwd, workspace);
        assert.strictEqual(options.env.AZP_COVERAGE_TRUSTED_SOURCE_DIRECTORIES, workspace);
    });

    for (const message of ['spawn ENOENT', 'publisher exited with code 1']) {
        it(`fails explicitly without stderr on ${message}`, async function () {
            execError = new Error(message);
            await publisher.PublishCodeCoverage(['coverage.xml'], undefined, true, [workspace], true);
            assert.deepStrictEqual(failures, [`CoveragePublisherExecutionFailed: ${message}`]);
        });
    }

    it('waits for publishing only when containment is enabled', async function () {
        let completed = false;
        const publishing = publisher.PublishCodeCoverage(
            ['coverage.xml'], undefined, true, [workspace], true).then(() => { completed = true; });
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.strictEqual(completed, false);
        finishExecution();
        await publishing;
        assert.strictEqual(completed, true);
    });

    it('preserves flag-off cwd, quoting, validation and non-awaited publishing', async function () {
        directoryExists = false;
        await publisher.PublishCodeCoverage(['coverage.xml'], sources, true, [workspace], false);

        assert.deepStrictEqual(checkedDirectories, []);
        assert.deepStrictEqual(resourcePaths, []);
        assert.strictEqual(options.cwd, process.cwd());
        assert.strictEqual(options.windowsVerbatimArguments, true);
        assert.strictEqual(options.env.AZP_COVERAGE_TRUSTED_SOURCE_DIRECTORIES, undefined);
        assert(!args.includes('--trustedSourceDirectory'));
        assert(!args.includes('--enableTrustedSourcePathFiltering'));
        assert.strictEqual(args[args.indexOf('--sourceDirectory') + 1], sources);
        assert.deepStrictEqual(failures, []);
    });

    it('preserves flag-off behavior with no roots and a launch error', async function () {
        execError = new Error('spawn ENOENT');
        await publisher.PublishCodeCoverage(['coverage.xml'], undefined, true, undefined, false);
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.deepStrictEqual(checkedDirectories, []);
        assert.deepStrictEqual(failures, []);
        assert.strictEqual(options.windowsVerbatimArguments, true);
    });
});
