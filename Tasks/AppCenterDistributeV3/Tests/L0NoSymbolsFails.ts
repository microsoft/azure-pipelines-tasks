
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { basicSetup, mockAzure } from './UnitTests/TestHelpers';

const mockery = require('mockery');
let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'Apple');
tmr.setInput('dsymPath', '/test/path/to/symbols.dSYM');

basicSetup();

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
    "checkPath" : {
        "./test.ipa": true
    },
    "exist": {
        "/test/path/to/symbols.dSYM": false
    }
};

mockAzure();

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.setAnswers(a);

tmr.run();

mockery.deregisterMock('azure-blob-upload-helper', azureBlobUploadHelper);
