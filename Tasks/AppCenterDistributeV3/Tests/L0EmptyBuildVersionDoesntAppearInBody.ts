import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');

const Readable = require('stream').Readable
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

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases')
    .reply(201, {
        id: 1,
        upload_url: "https://upload.example.test/upload/upload_chunk/1",
        package_asset_id: 1,
        upload_domain: 'https://example.upload.test/release_upload',
        url_encoded_token: "fdsf"
    }).log(console.log);

nock('https://example.upload.test')
    .post('/release_upload/upload/upload_chunk/1')
    .query(true)
    .reply(200, {

    }).log(console.log);

nock('https://example.upload.test')
    .post('/release_upload/upload/finished/1')
    .query(true)
    .reply(200, {
        error: false,
        state: "Done",
    }).log(console.log);

nock('https://example.test')
    .get('/v0.1/apps/testuser/testapp/uploads/releases/1')
    .query(true)
    .reply(200, {
        release_distinct_id: 1,
        upload_status: "readyToBePublished",
    }).log(console.log);

nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/uploads/releases/1', {
        upload_status: "committed",
    })
    .query(true)
    .reply(200, {
        upload_status: "committed",
        release_url: 'https://example.upload.test/release_upload',
    }).log(console.log);

nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/uploads/releases/1', {
        upload_status: "uploadFinished",
    })
    .query(true)
    .reply(200, {
        upload_status: "uploadFinished",
        release_url: 'https://example.upload.test/release_upload',
    }).log(console.log);

nock('https://example.upload.test')
    .post('/release_upload/upload/set_metadata/1')
    .query(true)
    .reply(200, {
        resume_restart: false,
        chunk_list: [1],
        chunk_size: 100,
        blob_partitions: 1
    }).log(console.log);

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases', body => body.build_version)
    .reply(404, {
        upload_id: 1,
        upload_url: 'https://example.upload.test/release_upload'
    }).log(console.log);

//finishing upload, commit the package
nock('https://example.test')
    .patch("/v0.1/apps/testuser/testapp/release_uploads/1", {
        status: 'committed'
    })
    .reply(200, {
        release_id: '1',
        release_url: 'my_release_location'
    });

//make it available
nock('https://example.test')
    .post("/v0.1/apps/testuser/testapp/releases/1/groups", {
        id: "00000000-0000-0000-0000-000000000000"
    })
    .reply(200);

nock('https://example.test')
    .put('/v0.1/apps/testuser/testapp/releases/1', JSON.stringify({
        release_notes: 'my release notes'
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

//finishing symbol upload, commit the symbol 
nock('https://example.test')
    .patch("/v0.1/apps/testuser/testapp/symbol_uploads/100", {
        status: 'committed'
    })
    .reply(200);

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

fs.createReadStream = (s: string) => {
    let stream = new Readable;
    stream.push(s);
    stream.push(null);

    return stream;
};

azureBlobUploadHelper.AzureBlobUploadHelper.prototype.upload = async () => {
    return Promise.resolve();
};

let fsos = fs.openSync;
fs.openSync = (path: string, flags: string) => {
    if (path.endsWith("my.apk")){
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
    stat.isFile = () => s.endsWith('.txt') || s.endsWith('.apk');
    stat.isDirectory = () => !s.endsWith('.txt') && !s.endsWith('.apk');
    stat.size = 100;
    return stat;
}
fs.lstatSync = fs.statSync;

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', fs);

tmr.run();

