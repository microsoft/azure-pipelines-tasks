import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
const Stats = require('fs').Stats;

var nock = require('nock');

var Readable = require('stream').Readable
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

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases', body => !body.build_version)
    .reply(201, {
        id: 1,
        upload_url: "https://upload.example.test/upload/upload_chunk/00000000-0000-0000-0000-000000000000",
        package_asset_id: 1,
        upload_domain: 'https://example.upload.test/release_upload',
        url_encoded_token: "fdsf"
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
    .times(21)
    .reply(422, {

    });

nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/uploads/releases/1')
    .reply(200, {
    }).log(console.log);

fs.createReadStream = (s: string) => {
    let stream = new Readable;
    stream.push(s);
    stream.push(null);

    return stream;
};

azureBlobUploadHelper.AzureBlobUploadHelper.prototype.upload = async () => {
    return Promise.resolve();
}

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
        console.log("Using mocked fs.openSync");
        return 1234567.89;
    }
    return fsos(path, flags);
};
let fsrs = fs.readSync;
fs.readSync = (fd: number, buffer: Buffer, offset: number, length: number, position: number)=> {
    if (fd==1234567.89) {
        buffer = new Buffer(100);
        console.log("Using mocked fs.readSync");
        return;
    }
    return fsrs(fd, buffer, offset, length, position);
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

