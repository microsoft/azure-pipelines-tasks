import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');

var nock = require('nock');

var Readable = require('stream').Readable
let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.zip');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('isMandatory', 'True');
tmr.setInput('destinationType', 'stores');
tmr.setInput('destinationStoreId', '11111111-1111-1111-1111-111111111111');

//prepare upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/release_uploads', body => !body.build_version)
    .reply(201, {
        upload_id: 1,
        upload_url: 'https://example.upload.test/release_upload'
    });

//upload
nock('https://example.upload.test')
    .post('/release_upload') // we expect that uploading zip without build version leads to error
    .reply(422, {
        status: 'failed'
    });

fs.createReadStream = (s: string) => {
    let stream = new Readable;
    stream.push(s);
    stream.push(null);

    return stream;
};

azureBlobUploadHelper.AzureBlobUploadHelper.prototype.upload = async () => {
    return Promise.resolve();
}

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', fs);
tmr.run();

