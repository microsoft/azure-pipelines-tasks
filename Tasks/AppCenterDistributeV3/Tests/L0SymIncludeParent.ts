
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { basicSetup, mockAzure, mockFs } from './UnitTests/TestHelpers';

const Stats = require('fs').Stats;
const mockery = require('mockery');
const nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'AndroidJava');
tmr.setInput('mappingTxtPath', '/test/path/to/mappings.txt');
tmr.setInput('packParentFolder', 'true');

basicSetup();

//begin symbol upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/symbol_uploads', {
        symbol_type: 'AndroidJava'
    })
    .reply(201, {
        symbol_upload_id: 100,
        upload_url: 'https://example.upload.test/symbol_upload',
        expiration_date: 1234567
    });

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        './test.ipa': true,
        '/test/path/to/mappings.txt': true,
        '/test/path/to': true,
        '/test/path/to/f1.txt': true,
        '/test/path/to/f2.txt': true,
        '/test/path/to/folder': true,
        '/test/path/to/folder/f11.txt': true,
        '/test/path/to/folder/f12.txt': true
    },
    'findMatch': {
        '/test/path/to/mappings.txt': [
            '/test/path/to/mappings.txt'
        ],
        './test.ipa': [
            './test.ipa'
        ]
    }
};
tmr.setAnswers(a);

const mockedFs = {...fs, ...mockFs()};

mockedFs.readdirSync = (folder: string | Buffer): any[] => {
    let files: string[] = [];

    if (folder === '/test/path/to') {
        files = [
            'mappings.txt',
            'f1.txt',
            'f2.txt',
            'folder'
        ]
    } else if (folder === '/test/path/to/folder') {
        files = [
            'f11.txt',
            'f12.txt'
        ]
    }

    return files;
};

mockedFs.statSync = (s: string) => {
    let stat = new Stats;
    //    s = s.replace("\\", "/");

    stat.isFile = () => {
        if (s === '/test/path/to') {
            return false;
        } else if (s === '/test/path/to/folder') {
            return false;
        } else {
            return true;
        }
    }

    stat.isDirectory = () => {
        if (s === '/test/path/to') {
            return true;
        } else if (s === '/test/path/to/folder') {
            return true;
        } else {
            return false;
        }
    }
    stat.size = 100;
    return stat;
}

mockAzure();

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', mockedFs);

tmr.run();

mockery.deregisterMock('fs');
mockery.deregisterMock('azure-blob-upload-helper');