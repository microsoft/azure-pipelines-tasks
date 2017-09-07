import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import mockTask = require('vsts-task-lib/mock-task');

const taskPath = path.join(__dirname, '..', 'download.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("definition", "myfreestyleproject")
tr.setInput("version", "15");
tr.setInput("downloadPattern", "*");
tr.setInput("downloadPath", "");
tr.setInput("connection", "connection1");
tr.setInput("downloadPath", "/");
tr.setInput("downloadCommitsAndWorkItems", "true");
tr.setInput("previousJenkinsJob", "15"); // same as version
tr.setInput("artifactDetailsFileNameSuffix", "alias_v1.json");

process.env['ENDPOINT_URL_connection1'] = 'http://url';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_username'] = 'dummyusername';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_password'] = 'dummypassword';
process.env['ENDPOINT_DATA_connection1_acceptUntrustedCerts'] = 'true';

tr.registerMock("item-level-downloader/Engine" , { 
    FetchEngine: function() {
        return { 
            fetchItems: function(A,B,C) {},
        }
    } ,
    FetchEngineOptions: function() {
    }
});

tr.registerMock("request", {
    get: function(urlObject, callback) {
    }
});

tr.run();
