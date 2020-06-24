import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

var nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('isMandatory', 'True');
tmr.setInput('destinationType', 'store');
tmr.setInput('destinationStoreId', '11111111-1111-1111-1111-111111111111');

//prepare upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases')
    .reply(201, {
        id: 1,
        upload_url: "https://upload.example.test/upload/upload_chunk/00000000-0000-0000-0000-000000000000",
        package_asset_id: 1,
        upload_domain: 'https://example.upload.test/release_upload',
        url_encoded_token: "fdsf"
    }).log(console.log);

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

nock('https://example.test')
    .put('/v0.1/apps/testuser/testapp/releases/1')
    .query(true)
    .reply(200, {
        version: '1',
        short_version: '1.0',
    });

//finishing upload, commit the package
nock('https://example.test')
    .patch("/v0.1/apps/testuser/testapp/release_uploads/1", {
        status: 'committed'
    })
    .reply(200, {
        release_id: '1',
        release_url: 'my_release_location'
    });


nock('https://example.test')
    .put('/v0.1/apps/testuser/testapp/releases/1', JSON.stringify({
        release_notes: 'my release notes'
    }))
    .reply(200);

//make it available
//JSON.stringify to verify exact match of request body: https://github.com/node-nock/nock/issues/571
nock('https://example.test')
    .post("/v0.1/apps/testuser/testapp/releases/1/stores", JSON.stringify({
        id: "11111111-1111-1111-1111-111111111111"
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

//finishing symbol upload, commit the symbol
nock('https://example.test')
    .patch("/v0.1/apps/testuser/testapp/symbol_uploads/100", {
        status: 'committed'
    })
    .reply(200);


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

tmr.run();

