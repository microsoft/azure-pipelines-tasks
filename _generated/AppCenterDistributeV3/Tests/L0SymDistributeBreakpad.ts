
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { basicSetup, mockFs } from './UnitTests/TestHelpers';

const Stats = require('fs').Stats;
const libMocker = require('azure-pipelines-task-lib/lib-mocker');
const nock = require('nock');

const taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.apk');
tmr.setInput('symbolsType', 'Android');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('nativeLibrariesPath', '/local/**/*.so')

basicSetup();

// begin symbol upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/symbol_uploads', {
        symbol_type: 'Breakpad'
    })
    .reply(201, {
        symbol_upload_id: 100,
        upload_url: 'https://example.upload.test/symbol_upload',
        expiration_date: 1234567
    });

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/releases/1/groups', {
        id: "00000000-0000-0000-0000-000000000000",
        mandatory_update: false
    }).reply(200);
// provide answers for task mock
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        '/test/path/to/my.apk': true,
        '/test/path/to': true,
        '/test/path/to/f1.txt': true,
        '/test/path/to/f2.txt': true,
        '/test/path/to/folder': true,
        '/test/path/to/folder/f11.txt': true,
        '/test/path/to/folder/f12.txt': true,
        '/local/x64/libSasquatchBreakpad.so': true,
        '/local/x86/libSasquatchBreakpad.so': true
    },
    'findMatch': {
        '/local/**/*.so': [
            '/local/x86/libSasquatchBreakpad.so',
            '/local/x64/libSasquatchBreakpad.so'
        ],
        '/test/path/to/my.apk': [
            '/test/path/to/my.apk'
        ]
    }
};
tmr.setAnswers(a);

const mockedFs = {...fs, ...mockFs()};

mockedFs.createReadStream = fs.createReadStream;
mockedFs.readdirSync = (folder: string | Buffer): any[] => {
    let files: string[] = [];
    if (folder === '/test/path/to') {
        files = [
            'mappings.txt',
            'f1.txt',
            'f2.txt',
            'folder'
        ]
    } else if (folder === '/test/path/to/folder') {
        files = [
            'f11.txt',
            'f12.txt'
        ]
    }
    return files;
};

mockedFs.statSync = (s: string) => {
    const stat = new Stats;
    stat.isFile = () => s.endsWith('.txt');
    stat.isDirectory = () => !s.endsWith('.txt');
    stat.size = 100;
    return stat;
}
mockedFs.lstatSync = mockedFs.statSync;

azureBlobUploadHelper.AzureBlobUploadHelper.prototype.upload = async (uploadUrl, file) => {
    if(file.toLowerCase().endsWith('.zip')) {
        return Promise.resolve();
    }
    throw new Error("Breakpad symbols always should be zipped");
}

let fsos = fs.openSync;

mockedFs.openSync = (path: string, flags: string) => {
    if (path.includes("/test/path/to") || path.endsWith("libSasquatchBreakpad.so") || path.endsWith(".apk")){
        return 1234567.89;
    }
    return fsos(path, flags);
}

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', mockedFs);

tmr.run();

libMocker.deregisterMock('fs');
libMocker.deregisterMock('azure-blob-upload-helper');
