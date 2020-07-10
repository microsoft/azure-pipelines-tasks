
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { mockFs, mockAzure } from './TestHelpers';

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

// upload 
nock('https://example.upload.test')
    .post('/release_upload')
    .reply(201, {
        status: 'success'
    });

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases')
    .reply(201, {
        id: 1,
        upload_url: "https://upload.example.test/upload/upload_chunk/00000000-0000-0000-0000-000000000000",
        package_asset_id: 1,
        upload_domain: 'https://example.upload.test/release_upload',
        url_encoded_token: "test"
    });

// finishing upload, commit the package
nock('https://example.test')
    .patch("/v0.1/apps/testuser/testapp/uploads/releases/1", {
        status: 'committed'
    })
    .reply(200, {
        release_url: 'my_release_location' 
    });

nock('https://example.upload.test')
    .post('/release_upload/upload/set_metadata/1')
    .query(true)
    .reply(200, {
        resume_restart: false,
        chunk_list: [1],
        chunk_size: 100,
        blob_partitions: 1
    });

nock('https://example.upload.test')
    .post('/release_upload/upload/upload_chunk/1')
    .query(true)
    .reply(200, {
    });

nock('https://example.upload.test')
    .post('/release_upload/upload/finished/1')
    .query(true)
    .reply(200, {
        error: false,
        state: "Done",
    });    
 
nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/uploads/releases/1', {
        upload_status: "uploadFinished",
    })
    .query(true)
    .reply(200, {
        upload_status: "uploadFinished",
        release_url: 'https://example.upload.test/release_upload',
    });   

nock('https://example.test')
    .get('/v0.1/apps/testuser/testapp/uploads/releases/1')
    .query(true)
    .reply(500, {
        release_distinct_id: 1,
        upload_status: "readyToBePublished",
    });

nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/uploads/releases/1', {
        upload_status: "committed",
    })
    .query(true)
    .reply(200, {
        upload_status: "committed",
        release_url: 'https://example.upload.test/release_upload',
    });

nock('https://example.test')
    .put('/v0.1/apps/testuser/testapp/releases/1')
    .query(true)
    .reply(200, {
        version: '1',
        short_version: '1.0',
    });

nock('https://example.test')
    .patch("/v0.1/apps/testuser/testapp/releases/1", {
    })
    .reply(201, {
    });

nock('https://example.test')
    .post("/v0.1/apps/testuser/testapp/releases/1", {
        id: "00000000-0000-0000-0000-000000000000"
    })
    .reply(200);

nock('https://example.test')
    .put('/v0.1/apps/testuser/testapp/releases/1', JSON.stringify({
        release_notes: 'my release notes'
    }))
    .reply(200);

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

nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/release_uploads/1', {
        status: "aborted",
    })
    .query(true)
    .reply(200, {
    });

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

// finishing symbol upload, commit the symbol 
nock('https://example.test')
    .patch("/v0.1/apps/testuser/testapp/symbol_uploads/100", {
        status: 'committed'
    })
    .reply(200);

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
