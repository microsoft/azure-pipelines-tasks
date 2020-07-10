
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { basicSetup, mockFs, mockAzure } from './TestHelpers';

const mockery = require('mockery');
const nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('isMandatory', 'True');
tmr.setInput('symbolsType', 'AndroidJava');
tmr.setInput('mappingTxtPath', '/test/path/to/mappings.txt');

process.env['BUILD_BUILDID'] = '2';
process.env['BUILD_SOURCEBRANCH'] = 'refs/heads/master';
process.env['BUILD_SOURCEVERSION'] = 'commitsha';

basicSetup();

// make it available
// JSON.stringify to verify exact match of request body: https://github.com/node-nock/nock/issues/571
nock('https://example.test')
    .patch("/my_release_location", JSON.stringify({
        status: "available",
        release_notes: "my release notes",
        mandatory_update: true,
        destinations: [{ id: "00000000-0000-0000-0000-000000000000" }],
        build: {
            id: '2',
            branch: 'master',
            commit_hash: 'commitsha'
        }
    }))
    .reply(200);

// begin symbol upload
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
        "/test/path/to/my.ipa": true,
        "/test/path/to/mappings.txt": true
    },
    "findMatch" : {
        "/test/path/to/mappings.txt": [
            "/test/path/to/mappings.txt"
        ],
        "/test/path/to/my.ipa": [
            "/test/path/to/my.ipa"
        ]
    }
};
tmr.setAnswers(a);

mockFs();

mockAzure();

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', fs);
tmr.run();
mockery.deregisterMock('fs', fs);
mockery.deregisterMock('azure-blob-upload-helper', azureBlobUploadHelper);
