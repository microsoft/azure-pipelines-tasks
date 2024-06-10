
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { basicSetup, mockAzure } from './UnitTests/TestHelpers';

const Stats = require('fs').Stats;
const libMocker = require('azure-pipelines-task-lib/lib-mocker');
const nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.appxbundle');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'UWP');
tmr.setInput('appxsymPath', 'a/my.appxsym');

basicSetup();

//begin symbol upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/symbol_uploads', {
        symbol_type: 'UWP'
    })
    .reply(201, {
        symbol_upload_id: 100,
        upload_url: 'https://example.upload.test/symbol_upload',
        expiration_date: 1234567
    });

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/releases/1/groups', {
        id: "00000000-0000-0000-0000-000000000000",
        mandatory_update: false
    }).reply(200);
// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath' : {
        './test.appxbundle': true,
        'a/my.appxsym': true
    },
    'findMatch' : {
        'a/my.appxsym': [
            'a/my.appxsym'
        ],
        './test.appxbundle': [
            './test.appxbundle'
        ]
    }
};
tmr.setAnswers(a);

const mockedFs = {...fs};

mockedFs.statSync = (s: string) => {
    let stat = new Stats;
    stat.isFile = () => s.endsWith('.appxsym');
    stat.isDirectory = () => !s.endsWith('.appxsym')
    stat.size = 100;
    return stat;
}

mockAzure();

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', mockedFs);

tmr.run();

libMocker.deregisterMock('fs');
libMocker.deregisterMock('azure-blob-upload-helper');
