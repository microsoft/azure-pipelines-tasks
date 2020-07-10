import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { mockFs, mockAzure } from './UnitTests/TestHelpers';
const Stats = require('fs').Stats;

const mockery = require('mockery');
const nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.zip');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('isMandatory', 'True');
tmr.setInput('destinationType', 'stores');
tmr.setInput('destinationStoreId', '11111111-1111-1111-1111-111111111111');

const uploadDomain = 'https://example.upload.test/release_upload';
const assetId = "00000000-0000-0000-0000-000000000123";
const uploadId = 7;

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases', body => !body.build_version)
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
    .times(21)
    .reply(422, {

    });

nock('https://example.test')
    .patch(`/v0.1/apps/testuser/testapp/uploads/releases/${uploadId}`)
    .reply(200, {
    });

mockFs();

mockAzure();

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "checkPath" : {
        "./test.zip": true,
    },
    "findMatch" : {
        "./test.zip": [
            "./test.zip"
        ]
    }
};
tmr.setAnswers(a);

let fsos = fs.openSync;

fs.openSync = (path: string, flags: string) => {
    if (path.endsWith("test.zip")){
        return 1234567.89;
    }
    return fsos(path, flags);
};

fs.statSync = (s: string) => {
    const stat = new Stats;
    stat.isFile = () => s.endsWith('.txt') || s.endsWith('.zip');
    stat.isDirectory = () => !s.endsWith('.txt') && !s.endsWith('.zip');
    stat.size = 100;
    return stat;
}
fs.lstatSync = fs.statSync;

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', fs);
tmr.run();

mockery.deregisterMock('fs', fs);
mockery.deregisterMock('azure-blob-upload-helper', azureBlobUploadHelper);
