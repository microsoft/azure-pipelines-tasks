import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { basicSetup, mockAzure, mockFs } from './UnitTests/TestHelpers';
const mockery = require('mockery');
const Stats = require('fs').Stats;
const nock = require('nock');
const taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.apk');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'AndroidJava');

basicSetup();

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases', body => body.build_version)
    .reply(404, {
        upload_id: 1,
        upload_url: 'https://example.upload.test/uploads/releases'
    });

//begin symbol upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/symbol_uploads', {
        symbol_type: "AndroidJava"
    })
    .reply(201, {
        symbol_upload_id: 100,
        upload_url: 'https://example.upload.test/symbol_upload',
        expiration_date: 1234567
    });

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "checkPath" : {
        "./test.apk": true,
    },
    "findMatch" : {
        "./test.apk": [
            "./test.apk"
        ]
    }
};
tmr.setAnswers(a);

mockAzure();

const mockedFs = {...fs, ...mockFs()};

let fsos = fs.openSync;
mockedFs.openSync = (path: string, flags: string) => {
    if (path.endsWith("my.apk")){
        return 1234567.89;
    }
    return fsos(path, flags);
};

mockedFs.statSync = (s: string) => {
    const stat = new Stats;
    stat.isFile = () => s.endsWith('.txt') || s.endsWith('.apk');
    stat.isDirectory = () => !s.endsWith('.txt') && !s.endsWith('.apk');
    stat.size = 100;
    return stat;
}
mockedFs.lstatSync = mockedFs.statSync;

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', mockedFs);

tmr.run();
mockery.deregisterMock('fs');
mockery.deregisterMock('azure-blob-upload-helper');

