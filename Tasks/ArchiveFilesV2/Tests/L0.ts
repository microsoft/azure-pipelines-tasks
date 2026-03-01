import * as assert from 'assert';
import * as utils from '../utils.js';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import fs = require('fs');
import path = require('path');
import tl = require('azure-pipelines-task-lib/task');

// path to creating archive
let expectedArchivePath: undefined | string = undefined;

describe('ArchiveFiles L0 Suite', function () {
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
            deleteFolderRecursive(testTemp);
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

            let tp: string = path.join(__dirname, 'L0CreateArchive.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();

            assert(tr.stdout.indexOf('Creating archive') > -1, 'Should have tried to create archive');
            assert(fs.existsSync(expectedArchivePath), `Should have successfully created the archive at ${expectedArchivePath}, instead directory contents are ${fs.readdirSync(path.dirname(expectedArchivePath))}`);
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

            let tp: string = path.join(__dirname, 'L0CreateArchive.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();

            assert(tr.stdout.indexOf('Creating archive') > -1, 'Should have tried to create archive');
            assert(fs.existsSync(expectedArchivePath), `Should have successfully created the archive at ${expectedArchivePath}, instead directory contents are ${fs.readdirSync(path.dirname(expectedArchivePath))}`);
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

        it('Successfully adds a single file to an existing archive', async function () {
            this.timeout(5000);
            process.env['archiveType'] = 'zip';
            process.env['archiveFile'] = 'singleFileArchive.zip';
            process.env['includeRootFolder'] = 'false';
            process.env['replaceExistingArchive'] = 'false';
            expectedArchivePath = path.join(__dirname, 'test_output', 'singleFileArchive.zip');

            // Create the initial archive
            let tp1: string = path.join(__dirname, 'L0CreateArchive.js');
            let tr1: ttm.MockTestRunner = new ttm.MockTestRunner(tp1);
            await tr1.runAsync();
            assert(fs.existsSync(expectedArchivePath), 'Should have created the initial archive');

            // Add a single file to the existing archive
            let tp2: string = path.join(__dirname, 'L0AddSingleFileToExisting.js');
            let tr2: ttm.MockTestRunner = new ttm.MockTestRunner(tp2);
            await tr2.runAsync();

            assert(tr2.succeeded, 'Task should have succeeded');
            assert(tr2.stdout.indexOf('Adding to existing archive') > -1 || 
                  tr2.stdout.indexOf('Adding file to archive') > -1 ||
                  tr2.stdout.indexOf('Archiving file:') > -1, 
                  'Should have added file to archive');
            assert(fs.existsSync(expectedArchivePath), 'Archive should still exist');
        });
    }
});
