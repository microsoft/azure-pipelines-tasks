import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");

let taskPath = path.join(__dirname, "..", "gradleauth.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const testUserHomeDir = path.join(__dirname, "USER_HOME");
const gradleDirName = ".gradle"
const gradleDirPath = path.join(testUserHomeDir, gradleDirName);
const gradlePropertiesName = "gradle.properties";
const gradlePropertiesPath = path.join(gradleDirPath, gradlePropertiesName);

// Set inputs
tr.setInput("artifactsFeeds", "feedName1");
tr.setInput("verbosity", "verbose");
tr.setInput("gradleServiceConnections", "");

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
        [gradleDirPath]: true,
        [gradlePropertiesPath]: true
    }
});

tr.run();
