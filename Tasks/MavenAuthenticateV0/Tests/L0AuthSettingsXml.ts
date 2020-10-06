import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");

let taskPath = path.join(__dirname, "..", "mavenauth.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const testUserHomeDir = path.join(__dirname, "USER_HOME");
const m2DirName = ".m2"
const m2DirPath = path.join(testUserHomeDir, m2DirName);
const settingsXmlName = "settings.xml";
const settingsXmlPath = path.join(m2DirPath, settingsXmlName);

// Set inputs
tr.setInput("artifactsFeeds", "feedName1");
tr.setInput("verbosity", "verbose");
tr.setInput("mavenServiceConnections", "");

let mockApi = {
    getSystemAccessToken: () => {
        return "token";
    }
};
tr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', mockApi);

// provide answers for task mock
tr.setAnswers({
    osType: {
        "osType": "Windows NT"
    },
    exist: {
        [m2DirPath]: false,
        [settingsXmlPath]: false
    }
});

tr.run();
