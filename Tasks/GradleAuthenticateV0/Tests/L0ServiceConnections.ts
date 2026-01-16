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
tr.setInput("artifactsFeeds", "");
tr.setInput("gradleServiceConnections", "tokenBased,usernamePasswordBased");
tr.setInput("verbosity", "verbose");

let mockApi = {
    getSystemAccessToken: () => {
        return "token";
    }
};
tr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', mockApi);

process.env["ENDPOINT_URL_tokenBased"] = "https://endpoint";
process.env["ENDPOINT_DATA_tokenBased_REPOSITORYID"] = "tokenBased";
process.env["ENDPOINT_AUTH_SCHEME_tokenBased"] = "token";
process.env["ENDPOINT_AUTH_tokenBased"] = JSON.stringify({
    "parameters": {
        "apitoken": "--token--"
    }
}); 

process.env["ENDPOINT_URL_usernamePasswordBased"] = "https://endpoint";
process.env["ENDPOINT_DATA_usernamePasswordBased_REPOSITORYID"] = "usernamePasswordBased";
process.env["ENDPOINT_AUTH_SCHEME_usernamePasswordBased"] = "usernamepassword";
process.env["ENDPOINT_AUTH_usernamePasswordBased"] = JSON.stringify({
    "parameters": {
        "username": "--testUserName--",
        "password": "--testPassword--"
    }
}); 

// provide answers for task mock
tr.setAnswers({
    osType: {
        "osType": "Windows NT"
    },
    exist: {
        [gradleDirPath]: false,
        [gradlePropertiesPath]: false
    }
});


tr.run();
