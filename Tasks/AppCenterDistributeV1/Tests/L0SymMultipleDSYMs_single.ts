
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { basicSetup, mockFs, mockAzure } from './TestHelpers';
const Stats = require('fs').Stats;
const mockery = require('mockery');
const nock = require('nock');
 
const taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'Apple');
tmr.setInput('dsymPath', 'a/**/*.dsym');

/*
  dSyms folder structure:
  a
    f.txt
    b
      f.txt
      c
        d
          f.txt
        f.txt
        x.dsym
          x1.txt
          x2.txt
*/

basicSetup();

//make it available
nock('https://example.test')
    .patch('/my_release_location', {
        status: 'available',
        destinations: [{ id: "00000000-0000-0000-0000-000000000000" }],
        release_notes: 'my release notes'
    })
    .reply(200);

//begin symbol upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/symbol_uploads', {
        symbol_type: 'Apple'
    })
    .reply(201, {
        symbol_upload_id: 100,
        upload_url: 'https://example.upload.test/symbol_upload',
        expiration_date: 1234567
    });

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath' : {
        '/test/path/to/my.ipa': true,
        'a': true,
        'a/f.txt': true,
        'a/b': true,
        'a/b/f.txt': true,
        'a/b/c': true,
        'a/b/c/f.txt': true,
        'a/b/c/d': true,
        'a/b/c/d/f.txt': true,
        'a/b/c/x.dsym': true,
        'a/b/c/x.dsym/x1.txt': true,
        'a/b/c/x.dsym/x2.txt': true
    },
    'findMatch' : {
        'a/**/*.dsym': [
            'a/b/c/x.dsym'
        ],
        '/test/path/to/my.ipa': [
            '/test/path/to/my.ipa'
        ]
    }
};
tmr.setAnswers(a);

mockFs();

fs.readdirSync = (folder: string | Buffer): any[] => {
    let files: string[] = [];

    if (folder === 'a') {
        files = [
            'f.txt',
            'b'
        ]
    } else if (folder === 'a/b') {
        files = [
            'f.txt',
            'c',
            'd'
        ]
    } else if (folder === 'a/b/c') {
        files = [
            'f.txt',
            'd',
            'x.dsym'
        ]
    } else if (folder === 'a/b/c/x.dsym') {
        files = [
            'x1.txt',
            'x2.txt'
        ]
    } else if (folder === 'a/b/c/d') {
        files = [
            'f.txt'
        ]
    }

    return files;
};

fs.statSync = (s: string) => {
    let stat = new Stats;
    stat.isFile = () => s.endsWith('.txt');
    stat.isDirectory = () => !s.endsWith('.txt');
    stat.size = 100;
    return stat;
}

mockAzure();

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', fs);

tmr.run();

mockery.deregisterMock('fs', fs);
mockery.deregisterMock('azure-blob-upload-helper', azureBlobUploadHelper);