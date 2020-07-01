
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { basicSetup } from './TestHelpers';

var Readable = require('stream').Readable
var Stats = require('fs').Stats

var nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'AndroidJava');
tmr.setInput('mappingTxtPath', '/test/path/to/mappings.txt');

basicSetup();

//make it available
nock('https://example.test')
    .patch("/my_release_location", {
        status: "available",
        destinations: [{ id: "00000000-0000-0000-0000-000000000000" }],
        release_notes: "my release notes"
    })
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

fs.createReadStream = (s: string) => {
    let stream = new Readable;
    stream.push(s);
    stream.push(null);

    return stream;
};

fs.statSync = (s: string) => {
    let stat = new Stats;
    
    stat.isFile = () => {
        return !s.toLowerCase().endsWith(".dsym");
    }
    stat.isDirectory = () => {
        return s.toLowerCase().endsWith(".dsym");
    }
    stat.size = 100;

    return stat;
};

let fsos = fs.openSync;
fs.openSync = (path: string, flags: string) => {
    if (path.endsWith("my.ipa")){
        return 1234567.89;
    }
    return fsos(path, flags);
};

let fsrs = fs.readSync;
fs.readSync = (fd: number, buffer: Buffer, offset: number, length: number, position: number)=> {
    if (fd==1234567.89) {
        buffer = new Buffer(100);
        return;
    }
    return fsrs(fd, buffer, offset, length, position);
};

fs.lstatSync = fs.statSync;

azureBlobUploadHelper.AzureBlobUploadHelper.prototype.upload = async () => {
    return Promise.resolve();
}

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', fs);

tmr.run();

