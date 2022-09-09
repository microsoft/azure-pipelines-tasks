
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import { basicSetup, mockFs } from './TestHelpers';

const mockery = require('mockery');
const nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['VSMOBILECENTERUPLOAD_CONTINUEIFSYMBOLSNOTFOUND']='true';

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/one.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'Apple');
tmr.setInput('dsymPath', '/test/path/to/symbols.dSYM');

basicSetup();

// make it available
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

mockFs();

tmr.registerMock('fs', fs);
tmr.run();
mockery.deregisterMock('fs', fs);