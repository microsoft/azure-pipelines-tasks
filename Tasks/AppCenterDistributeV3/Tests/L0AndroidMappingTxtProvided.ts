
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');

var Readable = require('stream').Readable
var Writable = require('stream').Writable
var Stats = require('fs').Stats

var nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.apk');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'Android');
tmr.setInput('mappingTxtPath', 'a/**/mapping.txt');

/*
  Mapping folder structure:
  a
    mapping.txt
*/

//prepare upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/release_uploads')
    .reply(201, {
        upload_id: 1,
        upload_url: 'https://example.upload.test/release_upload'
    });

//upload 
nock('https://example.upload.test')
    .post('/release_upload')
    .reply(201, {
        status: 'success'
    });

//finishing upload, commit the package
nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/release_uploads/1', {
        status: 'committed'
    })
    .reply(200, {
        release_id: '1',
        release_url: 'my_release_location'
    });

//make it available
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/releases/1/groups', {
        id: "00000000-0000-0000-0000-000000000000"
    })
    .reply(200);



nock('https://example.test')
    .put('/v0.1/apps/testuser/testapp/releases/1', JSON.stringify({
        release_notes: 'my release notes'
    }))
    .reply(200);

nock('https://example.test')
    .get('/v0.1/apps/testuser/testapp/releases/1')
    .reply(200, {
        short_version: "1.0",
        version: "1"
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

//finishing symbol upload, commit the symbol 
nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/symbol_uploads/100', {
        status: 'committed'
    })
    .reply(200);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath' : {
        '/test/path/to/my.apk': true,
        'a': true,
        'a/mapping.txt': true
    },
    'findMatch' : {
        'a/**/mapping.txt': [
            'a/mapping.txt'
        ],
        '/test/path/to/my.apk': [
            '/test/path/to/my.apk'
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

fs.createWriteStream = (s: string) => {
    let stream = new Writable;

    stream.write = () => {};

    return stream;
};

fs.readdirSync = (folder: string) => {
    let files: string[] = [];

    if (folder === 'a') {
        files = [
            'mapping.txt'
        ]
    }

    return files;
};

fs.statSync = (s: string) => {
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

azureBlobUploadHelper.AzureBlobUploadHelper.prototype.upload = async () => {
    return Promise.resolve();
}

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', fs);

tmr.run();

