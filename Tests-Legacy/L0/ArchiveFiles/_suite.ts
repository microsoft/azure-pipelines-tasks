/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import os = require('os');
var shell = require('shelljs');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
    process.env['MOCK_NORMALIZE_SLASHES'] = true;
}

describe('ArchiveFiles Suite', function () {
    this.timeout(10000);

    before((done) => {
        // init here
        done();
    });

    after(function () {

    });

    var tests = [
        {
            'file': 'test.zip',
            'type': 'zip',
            'tarCompression': 'none'
        },
        {
            'file': 'test.7z',
            'type': '7z',
            'tarCompression': 'none'
        },
        {
            'file': 'test.wim',
            'type': 'wim',
            'tarCompression': 'none'
        },
        {
            'file': 'test.tar',
            'type': 'tar',
            'tarCompression': 'none'
        },
        {
            'file': 'test.tar.gz',
            'type': 'tar',
            'tarCompression': 'gz'
        },
        {
            'file': 'test.tar.bz2',
            'type': 'tar',
            'tarCompression': 'bz2'
        },
        {
            'file': 'test.tar.xz',
            'type': 'tar',
            'tarCompression': 'xz'
        }
    ]

    tests.forEach((test) => {
        it('test root windows: archive ' + test.file, (done) => {
            setResponseFile('archiveFilesWin.json');

            var tr = new trm.TaskRunner('ArchiveFiles', true, true);
            tr.setInput('rootFolder', 'testRootFolder');
            tr.setInput('includeRootFolder', 'true');
            tr.setInput('archiveType', test.type);
            tr.setInput('archiveFile', test.file);
            tr.setInput('tarCompression', test.tarCompression);
            tr.setInput('replaceExistingArchive', 'true');
            var compressedTar = test.tarCompression != 'none';

            tr.run().then(() => {
                assert(tr.invokedToolCount == (compressedTar ? 2 : 1), 'should have archived ' + (compressedTar ? 2 : 1) + '  file(s)');
                if (compressedTar) {
                    var tarName = test.file.slice(0, test.file.lastIndexOf('.'));
                    assert((tr.stdout.indexOf('created ' + tarName + ' testRootFolder') != -1), 'should have created ' + tarName);
                    assert((tr.stdout.indexOf('created ' + test.file + ' ' + tarName) != -1), 'should have created ' + test.file);
                } else {
                    assert((tr.stdout.indexOf('created ' + test.file + ' testRootFolder') != -1), 'should have created ' + test.file);
                }

                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            }).fail((err) => {
                done(err);
            });
        });
        it('test no root windows: archive ' + test.file, (done) => {
            setResponseFile('archiveFilesWin.json');

            var tr = new trm.TaskRunner('ArchiveFiles', true, true);
            tr.setInput('rootFolder', 'testRootFolder');
            tr.setInput('includeRootFolder', 'false');
            tr.setInput('archiveType', test.type);
            tr.setInput('archiveFile', test.file);
            tr.setInput('tarCompression', test.tarCompression);
            tr.setInput('replaceExistingArchive', 'true');
            var compressedTar = test.tarCompression != 'none';

            tr.run().then(() => {
                assert(tr.invokedToolCount == (compressedTar ? 2 : 1), 'should have archived ' + (compressedTar ? 2 : 1) + '  file(s)');
                if (compressedTar) {
                    var tarName = test.file.slice(0, test.file.lastIndexOf('.'));
                    assert((tr.stdout.indexOf('created ' + tarName + ' one two three') != -1), 'should have created ' + tarName);
                    assert((tr.stdout.indexOf('created ' + test.file + ' ' + tarName) != -1), 'should have created ' + test.file);
                } else {
                    assert((tr.stdout.indexOf('created ' + test.file + ' one two three') != -1), 'should have created ' + test.file);
                }

                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            }).fail((err) => {
                done(err);
            });
        });
    });
    tests.forEach((test) => {
        it('test root linux: archive ' + test.file, (done) => {
            setResponseFile('archiveFilesLinux.json');

            var tr = new trm.TaskRunner('ArchiveFiles', true, true);
            tr.setInput('rootFolder', 'testRootFolder');
            tr.setInput('includeRootFolder', 'true');
            tr.setInput('archiveType', test.type);
            tr.setInput('archiveFile', test.file);
            tr.setInput('tarCompression', test.tarCompression);
            tr.setInput('replaceExistingArchive', 'true');

            tr.run().then(() => {
                assert(tr.invokedToolCount == 1, 'should have archived 1 file(s)');
                assert((tr.stdout.indexOf('created ' + test.file + ' testRootFolder') != -1), 'should have created ' + test.file);
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            }).fail((err) => {
                done(err);
            });
        });
        it('test no root linux: archive ' + test.file, (done) => {
            setResponseFile('archiveFilesLinux.json');

            var tr = new trm.TaskRunner('ArchiveFiles', true, true);
            tr.setInput('rootFolder', 'testRootFolder');
            tr.setInput('includeRootFolder', 'false');
            tr.setInput('archiveType', test.type);
            tr.setInput('archiveFile', test.file);
            tr.setInput('tarCompression', test.tarCompression);
            tr.setInput('replaceExistingArchive', 'true');

            tr.run().then(() => {
                assert(tr.invokedToolCount == 1, 'should have archived 1 file(s)');
                assert((tr.stdout.indexOf('created ' + test.file + ' one two three') != -1), 'should have created ' + test.file);
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            }).fail((err) => {
                done(err);
            });
        });
    });
});
