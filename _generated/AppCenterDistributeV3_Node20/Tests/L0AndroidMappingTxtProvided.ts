
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { basicSetup, mockFs, mockAzure } from './UnitTests/TestHelpers';
const mockery = require('mockery');
const Stats = require('fs').Stats;
const nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.apk');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'Android');
tmr.setInput('mappingTxtPath', 'a/**/mapping.txt');

/*
  Mapping folder structure:
  a
    mapping.txt
*/

basicSetup();

nock('https://example.test')
    .get('/v0.1/apps/testuser/testapp/releases/1')
    .query(true)
    .reply(200, {
        version: '1',
        short_version: '1.0',
    });

//begin symbol upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/symbol_uploads', {
        symbol_type: "AndroidProguard",
        file_name: "mapping.txt",
        version: "1.0",
        build: "1"
    })
    .reply(201, {
        symbol_upload_id: 100,
        upload_url: 'https://example.upload.test/symbol_upload',
        expiration_date: 1234567
    });

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath' : {
        './test.apk': true,
        'a': true,
        'a/mapping.txt': true
    },
    'findMatch' : {
        'a/**/mapping.txt': [
            'a/mapping.txt'
        ],
        './test.apk': [
            './test.apk'
        ]
    }
};
tmr.setAnswers(a);

const mockedFs = {...fs, ...mockFs()};

mockedFs.readdirSync = (folder: string | Buffer): any[] => {
    let files: string[] = [];
    if (folder === 'a') {
        files = [
            'mapping.txt'
        ]
    }
    return files;
};

mockedFs.statSync = (s: string) => {
    const stat = new Stats;
    stat.isFile = () => {
        return s.endsWith('.txt');
    }
    stat.isDirectory = () => {
        return !s.endsWith('.txt');
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

