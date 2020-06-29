
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
const Readable = require('stream').Readable
const Stats = require('fs').Stats

const nock = require('nock');

const taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['VSMOBILECENTERUPLOAD_CONTINUEIFSYMBOLSNOTFOUND']='true';

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/one.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'Apple');
tmr.setInput('dsymPath', '/test/path/to/symbols.dSYM');

nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/releases/1')
    .query(true)
    .reply(200);

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases')
    .query(true)
    .reply(201, {
        id: 1,
        upload_url: "https://upload.example.test/upload/upload_chunk/1",
        package_asset_id: 1,
        upload_domain: 'https://example.upload.test/release_upload',
        url_encoded_token: "fdsf"
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
    .get('/v0.1/apps/testuser/testapp/uploads/releases/1')
    .query(true)
    .reply(200, {
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
    .patch('/v0.1/apps/testuser/testapp/uploads/releases/1', {
        upload_status: "uploadFinished",
    })
    .query(true)
    .reply(200, {
        upload_status: "uploadFinished",
        release_url: 'https://example.upload.test/release_upload',
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

//finishing upload, commit the package
nock('https://example.test')
    .patch("/v0.1/apps/testuser/testapp/release_uploads/1", {
        status: 'committed'
    })
    .reply(200, {
        release_url: 'my_release_location' 
    });

//make it available
nock('https://example.test')
    .patch("/my_release_location", {
        status: "available",
        destinations: [{ id: "00000000-0000-0000-0000-000000000000" }],
        release_notes: "my release notes"
    })
    .reply(200);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "findMatch": {
        "/test/path/to/one.ipa": [
            "/test/path/to/one.ipa"
        ],
        "/test/path/to/symbols.dSYM": [
            "/test/path/to/symbols.dSYM"
        ]
    },
    "checkPath" : {
        "/test/path/to/one.ipa": true
    },
    "exist": {
        "/test/path/to/symbols.dSYM": false
    }
};
tmr.setAnswers(a);

fs.createReadStream = (s) => {
    let stream = new Readable;
    stream.push(s);
    stream.push(null);

    return stream;
};

fs.statSync = (s) => {
    let stat = new Stats;
    stat.isFile = () => {
        return true;
    }

    stat.size = 100;
    return stat;
}

let fsos = fs.openSync;
fs.openSync = (path: string, flags: string) => {
    if (path.endsWith("one.ipa")){
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

tmr.registerMock('fs', fs);

tmr.run();

