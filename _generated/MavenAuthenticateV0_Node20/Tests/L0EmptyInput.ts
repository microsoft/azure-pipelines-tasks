import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");

let taskPath = path.join(__dirname, "..", "mavenauth.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tr.setInput("artifactsFeeds", "");
tr.setInput("verbosity", "verbose");
tr.setInput("mavenServiceConnections", "");

let mockApi = {
    getSystemAccessToken: () => {
        return "token";
    }
};
tr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', mockApi);

tr.run();
