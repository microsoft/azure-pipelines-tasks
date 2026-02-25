import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'universalmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set up minimal environment
process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";

tmr.setInput('command', 'download');
tmr.setInput('downloadDirectory', ''); // Empty directory
tmr.setInput('internalOrExternalDownload', 'internal');
tmr.setInput('feedListDownload', 'TestFeed');
tmr.setInput('packageListDownload', 'TestPackage');
tmr.setInput('versionListDownload', '1.0.0');

tmr.run();
