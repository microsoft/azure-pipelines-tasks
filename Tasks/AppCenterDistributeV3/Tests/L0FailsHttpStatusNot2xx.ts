
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { mockFs, mockAzure } from './UnitTests/TestHelpers';

const nock = require('nock');
const mockery = require('mockery');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('isMandatory', 'True');
tmr.setInput('symbolsType', 'AndroidJava');
tmr.setInput('mappingTxtPath', '/test/path/to/mappings.txt');

process.env['BUILD_BUILDID'] = '2';
process.env['BUILD_SOURCEBRANCH'] = 'refs/heads/master';
process.env['BUILD_SOURCEVERSION'] = 'commitsha';

const uploadDomain = 'https://example.upload.test/uploads/releases';
const assetId = "00000000-0000-0000-0000-000000000123";
const uploadId = 7;

nock('https://example.test')
  .post('/v0.1/apps/testuser/testapp/uploads/releases')
  .reply(201, {
      id: uploadId,
      package_asset_id: assetId,
      upload_domain: uploadDomain,
      url_encoded_token: "token"
  });

nock(uploadDomain)
  .post(`/upload/set_metadata/${assetId}`)
  .query(true)
  .reply(200, {
      resume_restart: false,
      chunk_list: [1],
      chunk_size: 100,
      blob_partitions: 1
  });

nock(uploadDomain)
  .post(`/upload/upload_chunk/${assetId}`)
  .query(true)
  .reply(200, {

  });

nock(uploadDomain)
  .post(`/upload/finished/${assetId}`)
  .query(true)
  .reply(200, {
      error: false,
      state: "Done",
  });

nock('https://example.test')
  .get(`/v0.1/apps/testuser/testapp/uploads/releases/${uploadId}`)
  .query(true)
  .reply(500, {
      release_distinct_id: 1,
      upload_status: "readyToBePublished",
  });

nock('https://example.test')
  .patch(`/v0.1/apps/testuser/testapp/uploads/releases/${uploadId}`, {
      upload_status: "uploadFinished",
  })
  .query(true)
  .reply(200, {
      upload_status: "uploadFinished"
  });

  nock('https://example.test')
      .put('/v0.1/apps/testuser/testapp/releases/1', JSON.stringify({
          release_notes: 'my release notes'
      }))
      .reply(200);

  //make it available
  nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/releases/1/groups', {
      id: "00000000-0000-0000-0000-000000000000"
    })
    .reply(200);
          
  //finishing symbol upload, commit the symbol 
  nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/symbol_uploads/100', {
      status: 'committed'
    })
  .reply(200);

nock('https://example.test')
    .put('/v0.1/apps/testuser/testapp/releases/1')
    .query(true)
    .reply(200, {
        version: '1',
        short_version: '1.0',
    });

//make it available
//JSON.stringify to verify exact match of request body: https://github.com/node-nock/nock/issues/571
nock('https://example.test')
    .post("/v0.1/apps/testuser/testapp/releases/1/groups", JSON.stringify({
        id: "00000000-0000-0000-0000-000000000000",
        mandatory_update: true
    }))
    .reply(200);

nock('https://example.test')
    .put('/v0.1/apps/testuser/testapp/releases/1', JSON.stringify({
        release_notes: 'my release notes',
        build: {
            id: '2',
            branch: 'master',
            commit_hash: 'commitsha'
        }
    }))
    .reply(200);

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
    "checkPath": {
        "./test.ipa": true,
        "/test/path/to/mappings.txt": true
    },
    "findMatch": {
        "/test/path/to/mappings.txt": [
            "/test/path/to/mappings.txt"
        ],
        "./test.ipa": [
            "./test.ipa"
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

