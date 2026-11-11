import * as assert from 'assert';
import * as utils from '../utils.js';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import fs = require('fs');
import path = require('path');
import os = require('os');
import tl = require('azure-pipelines-task-lib/task');

// path to creating archive
let expectedArchivePath: undefined | string = undefined;

describe('ArchiveFiles L0 Suite', function () {
    function getRunnerDiagnostics(tr: ttm.MockTestRunner): string {
        const cmdlines = tr.cmdlines && tr.cmdlines.length ? tr.cmdlines.join(os.EOL) : '<none>';
        const errorIssues = tr.errorIssues && tr.errorIssues.length ? tr.errorIssues.join(os.EOL) : '<none>';
        const stderr = tr.stderr && tr.stderr.length ? tr.stderr : '<none>';

        return [
            `succeeded=${tr.succeeded}`,
            `failed=${tr.failed}`,
            `cmdlines=${cmdlines}`,
            `errorIssues=${errorIssues}`,
            `stderr=${stderr}`
        ].join(os.EOL);
    }

    function deleteFolderRecursive(directoryPath) {
        if (fs.existsSync(directoryPath)) {
            fs.readdirSync(directoryPath).forEach((file, index) => {
                const curPath = path.join(directoryPath, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    // recurse
                    deleteFolderRecursive(curPath);
                } else {
                    // delete file
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(directoryPath);
        }
    };

    before(() => {
        const testTemp = path.join(__dirname, 'test_temp');
        if (!fs.existsSync(testTemp)) {
            fs.mkdirSync(testTemp);
        }
        const testOutput = path.join(__dirname, 'test_output');
        if (!fs.existsSync(testOutput)) {
            fs.mkdirSync(testOutput);
        }

        const replaceTestOutput = path.join(__dirname, 'test_output', 'replace_test');
        if (!fs.existsSync(replaceTestOutput)) {
            fs.mkdirSync(replaceTestOutput);
        }
    })

    this.afterEach(() => {
        try {
            if (expectedArchivePath) fs.unlinkSync(expectedArchivePath);
            expectedArchivePath = undefined;
        } catch (err) {
            console.log('Cannot remove created archive: ' + expectedArchivePath);
        }
    });

    this.afterAll(() => {
        const testTemp = path.join(__dirname, 'test_temp');
        if (fs.existsSync(testTemp)) {
            deleteFolderRecursive(testTemp);
        }
        const testOutput = path.join(__dirname, 'test_output');
        if (fs.existsSync(testOutput)) {
            deleteFolderRecursive(testOutput);
        }
    })

    const files = (n) => {
        return Array.from(
            { length: n }, (v, k) => String(k)
        )
    };

    let test = this;
    let cases = [0, 1, 10, 11, 100];

    tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
    cases.forEach(function (numberOfFiles) {
        it(`Verify plan output for ${numberOfFiles} files has correct number of lines`, () => {
            test.timeout(1000);
            let max = 10;
            let plan = utils.reportArchivePlan(files(numberOfFiles), max);
            assert(plan.length == Math.min(numberOfFiles + 1, max + 2));
        });
    });

    it('Successfully creates a zip', async function () {
        this.timeout(10000);
        process.env['archiveType'] = 'zip';
        process.env['archiveFile'] = 'myZip';
        process.env['includeRootFolder'] = 'true';
        expectedArchivePath = path.join(__dirname, 'test_output', 'myZip.zip');

        let tp: string = path.join(__dirname, 'L0CreateArchive.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.stdout.indexOf('Creating archive') > -1, 'Should have tried to create archive');
        if (process.platform.indexOf('win32') >= 0) {
            assert(tr.stdout.indexOf('Add new data to archive: 3 folders, 3 files') > -1, 'Should have found 6 items to compress');
        } else {
            assert(tr.stdout.indexOf('adding: test_folder/ (') > -1, 'Should have found 6 items to compress');
            assert(tr.stdout.indexOf('adding: test_folder/a/ (') > -1, 'Should have found 6 items to compress');
            assert(tr.stdout.indexOf('adding: test_folder/a/abc.txt (') > -1, 'Should have found 6 items to compress');
            assert(tr.stdout.indexOf('adding: test_folder/a/def.txt (') > -1, 'Should have found 6 items to compress');
            assert(tr.stdout.indexOf('adding: test_folder/b/ (') > -1, 'Should have found 6 items to compress');
            assert(tr.stdout.indexOf('adding: test_folder/b/abc.txt (') > -1, 'Should have found 6 items to compress');
        }
        assert(fs.existsSync(expectedArchivePath), `Should have successfully created the archive at ${expectedArchivePath}, instead directory contents are ${fs.readdirSync(path.dirname(expectedArchivePath))}`);
    });

    it('Successfully creates a tar', async function () {
        this.timeout(5000);
        process.env['archiveType'] = 'tar';
        process.env['archiveFile'] = 'myTar';
        process.env['includeRootFolder'] = 'true';
        expectedArchivePath = path.join(__dirname, 'test_output', 'myTar.gz');
        if (process.platform.indexOf('win32') < 0) {
            expectedArchivePath = path.join(__dirname, 'test_output', 'myTar');
        }

        let tp: string = path.join(__dirname, 'L0CreateArchive.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdout.indexOf('Creating archive') > -1, 'Should have tried to create archive');
        assert(fs.existsSync(expectedArchivePath), `Should have successfully created the archive at ${expectedArchivePath}, instead directory contents are ${fs.readdirSync(path.dirname(expectedArchivePath))}`);
    });

    // These tests rely on 7z which isnt present on macOS
    if (process.platform.indexOf('darwin') < 0) {
        it('Successfully creates a 7z', async function () {
            this.timeout(5000);
            process.env['archiveType'] = '7z';
            process.env['archiveFile'] = 'my7z';
            process.env['includeRootFolder'] = 'true';
            expectedArchivePath = path.join(__dirname, 'test_output', 'my7z.7z');
            const previousSystemDebug = process.env['SYSTEM_DEBUG'];
            process.env['SYSTEM_DEBUG'] = 'true';

            let tp: string = path.join(__dirname, 'L0CreateArchive.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            try {
                await tr.runAsync();
            } finally {
                if (typeof previousSystemDebug === 'undefined') {
                    delete process.env['SYSTEM_DEBUG'];
                } else {
                    process.env['SYSTEM_DEBUG'] = previousSystemDebug;
                }
            }

            const diagnostics = getRunnerDiagnostics(tr);
            assert(tr.succeeded, `7z archive command should succeed.${os.EOL}${diagnostics}`);
            assert(tr.stdout.indexOf('Creating archive') > -1, `Should have tried to create archive.${os.EOL}${diagnostics}`);
            assert(fs.existsSync(expectedArchivePath), `Should have successfully created the archive at ${expectedArchivePath}, instead directory contents are ${fs.readdirSync(path.dirname(expectedArchivePath))}${os.EOL}${diagnostics}`);
        });

        it('Successfully creates a wim', async function () {
            this.timeout(5000);
            process.env['archiveType'] = 'wim';
            process.env['archiveFile'] = 'mywim';
            process.env['includeRootFolder'] = 'true';
            expectedArchivePath = path.join(__dirname, 'test_output', 'myWim.wim');
            if (process.platform.indexOf('win') < 0) {
                expectedArchivePath = path.join(__dirname, 'test_output', 'mywim.wim');
            }
            const previousSystemDebug = process.env['SYSTEM_DEBUG'];
            process.env['SYSTEM_DEBUG'] = 'true';

            let tp: string = path.join(__dirname, 'L0CreateArchive.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            try {
                await tr.runAsync();
            } finally {
                if (typeof previousSystemDebug === 'undefined') {
                    delete process.env['SYSTEM_DEBUG'];
                } else {
                    process.env['SYSTEM_DEBUG'] = previousSystemDebug;
                }
            }

            const diagnostics = getRunnerDiagnostics(tr);
            assert(tr.succeeded, `wim archive command should succeed.${os.EOL}${diagnostics}`);
            assert(tr.stdout.indexOf('Creating archive') > -1, `Should have tried to create archive.${os.EOL}${diagnostics}`);
            assert(fs.existsSync(expectedArchivePath), `Should have successfully created the archive at ${expectedArchivePath}, instead directory contents are ${fs.readdirSync(path.dirname(expectedArchivePath))}${os.EOL}${diagnostics}`);
        });

        it('Replace archive file in the root folder', async function () {
            const archiveName = "archive.zip";
            const replaceTestDir = path.join(__dirname, 'test_output', 'replace_test');
            const archivePath = path.join(replaceTestDir, archiveName);
            this.timeout(5000);
            process.env['archiveType'] = 'zip';
            process.env['archiveFile'] = archiveName;
            process.env['includeRootFolder'] = 'false';
            process.env['rootFolderOrFile'] = replaceTestDir;

            fs.writeFileSync(path.join(replaceTestDir, 'test_file.txt'), 'test data');

            fs.copyFileSync(
                path.join(__dirname, 'resources', archiveName),
                path.join(archivePath)
            );

            expectedArchivePath = archivePath;

            let tp: string = path.join(__dirname, 'L0ReplaceArchiveInRootFolder.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();
            console.info(tr.stdout);

            assert(tr.succeeded, "Task should succeed");
            assert(tr.stdout.indexOf('Creating archive') > -1, 'Should have tried to create archive');
            assert(fs.existsSync(expectedArchivePath), `Should have successfully created the archive at ${expectedArchivePath}, instead directory contents are ${fs.readdirSync(path.dirname(expectedArchivePath))}`);
        });
    }

    if (process.platform !== 'win32') {
        ['tar', 'zip'].forEach(function (archiveType) {
            it(`Passes option-like file names as operands for ${archiveType}`, async function () {
                this.timeout(10000);

                const dashTestDir = path.join(__dirname, 'test_output', 'dash_test');
                if (!fs.existsSync(dashTestDir)) {
                    fs.mkdirSync(dashTestDir, { recursive: true });
                }
                const optionLikeName = '--checkpoint=1';
                fs.writeFileSync(path.join(dashTestDir, 'normal.txt'), 'test data');
                fs.writeFileSync(path.join(dashTestDir, optionLikeName), 'test data');

                expectedArchivePath = path.join(__dirname, 'test_output', `dash.${archiveType}`);

                try {
                    process.env['rootFolderOrFile'] = dashTestDir;
                    process.env['archiveType'] = archiveType;
                    process.env['archiveFile'] = expectedArchivePath;

                    const tp: string = path.join(__dirname, 'L0DashPrefixedFiles.js');
                    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

                    await tr.runAsync();

                    assert(tr.succeeded,
                        `Task should succeed. stdout: ${tr.stdout}`);
                    assert(/\[command\][^\n]*\s--\s/.test(tr.stdout),
                        `Command line should contain the '--' end-of-options separator. stdout: ${tr.stdout}`);
                    assert(fs.existsSync(expectedArchivePath),
                        `Should have created ${expectedArchivePath}`);

                    const listing = fs.readFileSync(expectedArchivePath).toString('latin1');
                    assert(listing.indexOf(optionLikeName) > -1,
                        `Archive should contain the option-like file name.`);
                } finally {
                    fs.rmSync(dashTestDir, { recursive: true, force: true });
                }
            });
        });
    }

    type ExternalOutputCall = {
        message: string;
        options: tl.ExternalOutputOptions;
    };

    function runArchiveFilesWithMockedTaskLib(inputs: {
        archiveType: string;
        archiveFile: string;
        includeRootFolder?: boolean;
        replaceExistingArchive?: boolean;
        verbose?: boolean;
        tarCompression?: string;
        osType?: string;
        existingPaths?: Record<string, boolean>;
    }): ExternalOutputCall[] {
        const taskLib = require('azure-pipelines-task-lib/task');
        const testTemp = path.join(__dirname, 'test_temp');
        const rootFolderOrFile = path.join(testTemp, 'sink_test_input');

        fs.mkdirSync(rootFolderOrFile, { recursive: true });

        const archiveFile = path.normalize(inputs.archiveFile);
        const externalOutputs: ExternalOutputCall[] = [];
        const outputPathOverrides = new Map<string, boolean>(
            Object.entries(inputs.existingPaths ?? {}).map(([k, v]) => [path.normalize(k), v])
        );

        const originalTaskLib = {
            getVariable: taskLib.getVariable,
            getPathInput: taskLib.getPathInput,
            getBoolInput: taskLib.getBoolInput,
            getInput: taskLib.getInput,
            osType: taskLib.osType,
            setResourcePath: taskLib.setResourcePath,
            debug: taskLib.debug,
            warning: taskLib.warning,
            error: taskLib.error,
            exist: taskLib.exist,
            stats: taskLib.stats,
            rmRF: taskLib.rmRF,
            ls: taskLib.ls,
            mkdirP: taskLib.mkdirP,
            which: taskLib.which,
            tool: taskLib.tool,
            setResult: taskLib.setResult,
            writeExternalOutput: taskLib.writeExternalOutput,
            loc: taskLib.loc,
            TaskResult: taskLib.TaskResult
        };

        Object.assign(taskLib, {
            TaskResult: { Succeeded: 0, Failed: 1 },
            getVariable: (name: string) => {
                if (name === 'System.DefaultWorkingDirectory') {
                    return testTemp;
                }
                if (name === 'Agent.TempDirectory') {
                    return testTemp;
                }
                return '';
            },
            getPathInput: (name: string) => {
                if (name === 'rootFolderOrFile') {
                    return rootFolderOrFile;
                }
                if (name === 'archiveFile') {
                    return archiveFile;
                }
                return '';
            },
            getBoolInput: (name: string) => {
                if (name === 'includeRootFolder') {
                    return inputs.includeRootFolder ?? true;
                }
                if (name === 'replaceExistingArchive') {
                    return inputs.replaceExistingArchive ?? true;
                }
                if (name === 'verbose') {
                    return inputs.verbose ?? false;
                }
                if (name === 'quiet') {
                    return false;
                }
                return false;
            },
            getInput: (name: string) => {
                if (name === 'archiveType') {
                    return inputs.archiveType;
                }
                if (name === 'tarCompression') {
                    return inputs.tarCompression ?? 'gz';
                }
                if (name === 'sevenZipCompression') {
                    return '';
                }
                return '';
            },
            osType: () => inputs.osType ?? process.platform,
            setResourcePath: () => { },
            debug: () => { },
            warning: () => { },
            error: () => { },
            loc: (key: string, ...args: any[]) => `${key}:${args.join(',')}`,
            exist: (checkPath: string) => {
                const normalized = path.normalize(checkPath);
                if (outputPathOverrides.has(normalized)) {
                    return outputPathOverrides.get(normalized);
                }
                return fs.existsSync(normalized);
            },
            stats: () => ({ isFile: () => true }),
            rmRF: () => { },
            ls: () => [],
            mkdirP: () => { },
            which: (tool: string) => tool,
            tool: () => {
                const runner = {
                    arg: () => runner,
                    execSync: () => ({ code: 0, stdout: '', stderr: '', error: null })
                };
                return runner;
            },
            setResult: () => { },
            writeExternalOutput: (message: string | Buffer, options: tl.ExternalOutputOptions) => {
                externalOutputs.push({
                    message: message.toString(),
                    options
                });
            }
        });

        const archiveFilesModulePath = path.join(__dirname, '..', 'archivefiles.js');

        try {
            delete require.cache[require.resolve(archiveFilesModulePath)];
            require(archiveFilesModulePath);
        } finally {
            delete require.cache[require.resolve(archiveFilesModulePath)];
            Object.assign(taskLib, originalTaskLib);
        }

        return externalOutputs;
    }

    function findCall(calls: ExternalOutputCall[], predicate: (call: ExternalOutputCall) => boolean): ExternalOutputCall {
        const call = calls.find(predicate);
        assert(call, 'Expected external output call was not emitted');
        return call!;
    }

    it('Routes archive plan and overwrite notice through repository external output with EOL', () => {
        const archiveFile = path.join(__dirname, 'test_temp', 'replace-me.zip');
        const calls = runArchiveFilesWithMockedTaskLib({
            archiveType: 'zip',
            archiveFile,
            replaceExistingArchive: true,
            osType: 'Windows_NT',
            existingPaths: {
                [archiveFile]: true
            }
        });

        const removeBeforeCreation = findCall(calls, (call) => call.message === `RemoveBeforeCreation:${path.normalize(archiveFile)}${os.EOL}`);
        assert.strictEqual(removeBeforeCreation.options.source, 'repository');

        const expectedPlanLines = [
            `FoundNFiles:1${os.EOL}`,
            `ArchivingFile:sink_test_input${os.EOL}`
        ];

        expectedPlanLines.forEach((expectedLine) => {
            const planLine = findCall(calls, (call) => call.message === expectedLine);
            assert.strictEqual(planLine.options.source, 'repository');
        });
    });

    it('Routes existing-archive notice through repository external output with EOL', () => {
        const archiveFile = path.join(__dirname, 'test_temp', 'already-there.zip');
        const calls = runArchiveFilesWithMockedTaskLib({
            archiveType: 'zip',
            archiveFile,
            replaceExistingArchive: false,
            osType: 'Windows_NT',
            existingPaths: {
                [archiveFile]: true
            }
        });

        const alreadyExists = findCall(calls, (call) => call.message === `AlreadyExists:${path.normalize(archiveFile)}${os.EOL}`);
        assert.strictEqual(alreadyExists.options.source, 'repository');
    });

    it('Routes tar-exists and filename lines through repository external output with EOL', () => {
        const compressedTar = path.join(__dirname, 'test_temp', 'existing.tar.gz');
        const innerTar = path.join(__dirname, 'test_temp', 'existing.tar');

        const tarCalls = runArchiveFilesWithMockedTaskLib({
            archiveType: 'tar',
            archiveFile: compressedTar,
            tarCompression: 'gz',
            osType: 'Windows_NT',
            existingPaths: {
                [innerTar]: true
            }
        });

        const tarExists = findCall(tarCalls, (call) => call.message === `TarExists:${path.normalize(innerTar)}${os.EOL}`);
        assert.strictEqual(tarExists.options.source, 'repository');

        const zipCalls = runArchiveFilesWithMockedTaskLib({
            archiveType: 'zip',
            archiveFile: path.join(__dirname, 'test_temp', 'nonwin.zip'),
            osType: 'Linux'
        });

        const filename = findCall(zipCalls, (call) => call.message === `Filename:sink_test_input${os.EOL}`);
        assert.strictEqual(filename.options.source, 'repository');
    });

    it('Routes filename external output even when verbose is disabled', () => {
        const zipCalls = runArchiveFilesWithMockedTaskLib({
            archiveType: 'zip',
            archiveFile: path.join(__dirname, 'test_temp', 'quiet-nonwin.zip'),
            verbose: false,
            osType: 'Linux'
        });

        const filename = findCall(zipCalls, (call) => call.message === `Filename:sink_test_input${os.EOL}`);
        assert.strictEqual(filename.options.source, 'repository');
    });
});
