
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
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

process.env['BUILD_BUILDID'] = '2';
process.env['BUILD_SOURCEBRANCH'] = '$/teamproject/main';
process.env['BUILD_SOURCEVERSION'] = 'commitsha';

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
    .patch("/v0.1/apps/testuser/testapp/release_uploads/1", {
        status: 'committed'
    })
    .reply(200, {
        release_url: 'my_release_location' 
    });

//make it available
//JSON.stringify to verify exact match of request body: https://github.com/node-nock/nock/issues/571
nock('https://example.test')
    .patch("/my_release_location", JSON.stringify({
        status: "available",
        release_notes: "my release notes",
        mandatory_update: false,
        destinations: [{ id: "00000000-0000-0000-0000-000000000000" }],
        build: {
            id: '2',
            branch: '$/teamproject/main',
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

//upload symbols
nock('https://example.upload.test')
    .put('/symbol_upload')
    .reply(201, {
        status: 'success'
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
}
tmr.registerMock('fs', fs);

tmr.run();

