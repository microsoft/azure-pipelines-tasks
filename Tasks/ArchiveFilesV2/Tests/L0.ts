import * as assert from 'assert';
import * as utils from '../utils.js';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import fs = require('fs');
import os = require('os');
import path = require('path');
import tl = require('azure-pipelines-task-lib/task');

describe('ArchiveFiles L0 Suite', function () {
    function runValidations(validator: () => void, tr, done) {
        try {
            validator();
            done();
        }
        catch (error) {
            console.log('STDERR', tr.stderr);
            console.log('STDOUT', tr.stdout);
            done(error);
        }
    }
    
    before(() => {
        const testTemp = path.join(__dirname, 'test_temp');
        if (!fs.existsSync(testTemp)) {
            fs.mkdirSync(testTemp);
        }
        const testOutput = path.join(__dirname, 'test_output');
        if (!fs.existsSync(testOutput)) {
            fs.mkdirSync(testOutput);
        }
    })

    const files = (n) => {
        return Array.from(
          {length: n}, (v, k) => String(k)
        )
    };

    let test = this;
    let cases = [0, 1, 10, 11, 100];
    
    tl.setResourcePath(path.join( __dirname, '..', 'task.json'));
    cases.forEach(function(numberOfFiles) {
        it(`Verify plan output for ${numberOfFiles} files has correct number of lines`, (done: Mocha.Done) => {
            test.timeout(1000);
            let max = 10;
            let plan = utils.reportArchivePlan(files(numberOfFiles), max);
            assert(plan.length == Math.min(numberOfFiles+1, max+2));
    
            done();
        });
    });

    it('Successfully creates a zip', function(done: Mocha.Done) {
        this.timeout(10000);
        process.env['archiveType'] = 'zip';
        process.env['archiveFile'] = 'myZip';
        process.env['includeRootFolder'] = 'true';
        const expectedArchivePath = path.join(__dirname, 'test_output', 'myZip.zip');

        let tp: string = path.join(__dirname, 'L0CreateArchive.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        runValidations(() => {
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
        }, tr, done);
    });

    it('Successfully creates a tar', function(done: Mocha.Done) {
        this.timeout(5000);
        process.env['archiveType'] = 'tar';
        process.env['archiveFile'] = 'myTar';
        process.env['includeRootFolder'] = 'true';
        let expectedArchivePath = path.join(__dirname, 'test_output', 'myTar.gz');
        if (process.platform.indexOf('win32') < 0) {
            expectedArchivePath = path.join(__dirname, 'test_output', 'myTar');
        }

        let tp: string = path.join(__dirname, 'L0CreateArchive.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.stdout.indexOf('Creating archive') > -1, 'Should have tried to create archive');
            assert(fs.existsSync(expectedArchivePath), `Should have successfully created the archive at ${expectedArchivePath}, instead directory contents are ${fs.readdirSync(path.dirname(expectedArchivePath))}`);
        }, tr, done);
    });

// These tests rely on 7z which isnt present on macOS
if (process.platform.indexOf('darwin') < 0) {
    it('Successfully creates a 7z', function(done: Mocha.Done) {
        this.timeout(5000);
        process.env['archiveType'] = '7z';
        process.env['archiveFile'] = 'my7z';
        process.env['includeRootFolder'] = 'true';
        const expectedArchivePath = path.join(__dirname, 'test_output', 'my7z.7z');

        let tp: string = path.join(__dirname, 'L0CreateArchive.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
                assert(tr.stdout.indexOf('Creating archive') > -1, 'Should have tried to create archive');
                assert(fs.existsSync(expectedArchivePath), `Should have successfully created the archive at ${expectedArchivePath}, instead directory contents are ${fs.readdirSync(path.dirname(expectedArchivePath))}`);
        }, tr, done);
    });

    it('Successfully creates a wim', function(done: Mocha.Done) {
        this.timeout(5000);
        process.env['archiveType'] = 'wim';
        process.env['archiveFile'] = 'mywim';
        process.env['includeRootFolder'] = 'true';
        let expectedArchivePath = path.join(__dirname, 'test_output', 'myWim.wim');
        if (process.platform.indexOf('win') < 0) {
            expectedArchivePath = path.join(__dirname, 'test_output', 'mywim.wim');
        }

        let tp: string = path.join(__dirname, 'L0CreateArchive.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
                assert(tr.stdout.indexOf('Creating archive') > -1, 'Should have tried to create archive');
                assert(fs.existsSync(expectedArchivePath), `Should have successfully created the archive at ${expectedArchivePath}, instead directory contents are ${fs.readdirSync(path.dirname(expectedArchivePath))}`);
        }, tr, done);
    });
}
});
