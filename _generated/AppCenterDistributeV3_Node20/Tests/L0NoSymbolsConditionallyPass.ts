
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import { basicSetup } from './UnitTests/TestHelpers';
const Stats = require('fs').Stats;
const libMocker = require('azure-pipelines-task-lib/lib-mocker');
const nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['VSMOBILECENTERUPLOAD_CONTINUEIFSYMBOLSNOTFOUND'] = 'true';

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'Apple');
tmr.setInput('dsymPath', '/test/path/to/symbols.dSYM');

basicSetup();

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/releases/1/groups', {
        id: "00000000-0000-0000-0000-000000000000",
        mandatory_update: false
    }).reply(200);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "findMatch": {
        "./test.ipa": [
            "./test.ipa"
        ],
        "/test/path/to/symbols.dSYM": [
            "/test/path/to/symbols.dSYM"
        ]
    },
    "checkPath": {
        "./test.ipa": true
    },
    "exist": {
        "/test/path/to/symbols.dSYM": false
    }
};

tmr.setAnswers(a);
const mockedFs = { ...fs };

mockedFs.statSync = (s) => {
    let stat = new Stats;
    stat.isFile = () => {
        return true;
    }
    stat.size = 100;
    return stat;
};

tmr.registerMock('fs', mockedFs);

tmr.run();

libMocker.deregisterMock('fs');
