import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as shared from './TestShared';

const DefaultBuildContext: string = shared.formatPath("a/w/**");
const DefaultDockerFileInput = shared.formatPath("a/w/**/Dockerfile");
const DefaultWorkingDirectory: string = shared.formatPath("a/w");
const DockerfilePath: string = shared.formatPath("a/w/Dockerfile");
const DockerfilePath2: string = shared.formatPath("a/w/meta/Dockerfile");
const BuildContextPath: string = shared.formatPath("a/w");
const BuildContextPath2: string = shared.formatPath("a/w/meta");
const BuildContextPath3: string = shared.formatPath("a/w/context");
const Dockerfile: string = `FROM ubuntu\nCMD ["echo","Hello World!"]`

let taskPath = path.join(__dirname, '..', 'docker.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('containerRegistry', process.env[shared.TestEnvVars.containerRegistry] || "");
tr.setInput('repository', process.env[shared.TestEnvVars.repository] || "");
tr.setInput('command', process.env[shared.TestEnvVars.command] || "buildAndPush");
tr.setInput('Dockerfile', process.env[shared.TestEnvVars.dockerFile] || DefaultDockerFileInput);
tr.setInput('buildContext', process.env[shared.TestEnvVars.buildContext] || DefaultBuildContext);
tr.setInput('tags', process.env[shared.TestEnvVars.tags] || "11");
tr.setInput('arguments', process.env[shared.TestEnvVars.arguments] || "");

console.log("Inputs have been set");

process.env["RELEASE_RELEASENAME"] = "Release-1";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  DefaultWorkingDirectory;
process.env["SYSTEM_HOSTTYPE"] = process.env[shared.TestEnvVars.hostType] || shared.HostTypes.build;
process.env["SYSTEM_SERVERTYPE"] = "hosted";
process.env["ENDPOINT_AUTH_dockerhubendpoint"] = "{\"parameters\":{\"username\":\"testuser\", \"password\":\"regpassword\", \"email\":\"testuser1@microsoft.com\",\"registry\":\"https://index.docker.io/v1/\"},\"scheme\":\"UsernamePassword\"}";
process.env["ENDPOINT_AUTH_acrendpoint"] = "{\"parameters\":{\"username\":\"testacr\", \"password\":\"acrpassword\",\"registry\":\"https://testacr.azurecr.io/\"},\"scheme\":\"UsernamePassword\"}";

// Set variables used for common labels
process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = shared.SharedValues.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI;
process.env["SYSTEM_TEAMPROJECT"] = shared.SharedValues.SYSTEM_TEAMPROJECT;

// Set variables used for build labels
process.env["BUILD_REPOSITORY_NAME"] = process.env["SYSTEM_HOSTTYPE"] == shared.HostTypes.build ? shared.SharedValues.BUILD_REPOSITORY_NAME : "";
process.env["BUILD_REPOSITORY_URI"] = shared.SharedValues.BUILD_REPOSITORY_URI;
process.env["BUILD_SOURCEBRANCHNAME"] = shared.SharedValues.BUILD_SOURCEBRANCHNAME;
process.env["BUILD_SOURCEVERSION"] = shared.SharedValues.BUILD_SOURCEVERSION;
process.env["BUILD_DEFINITIONNAME"] = shared.SharedValues.BUILD_DEFINITIONNAME;
process.env["BUILD_BUILDNUMBER"] = shared.SharedValues.BUILD_BUILDNUMBER;
process.env["BUILD_BUILDURI"] = shared.SharedValues.BUILD_BUILDURI;

// Set variables used for release labels
process.env["RELEASE_DEFINITIONNAME"] = shared.SharedValues.RELEASE_DEFINITIONNAME;
process.env["RELEASE_RELEASEID"] = shared.SharedValues.RELEASE_RELEASEID;
process.env["RELEASE_RELEASEWEBURL"] = shared.SharedValues.RELEASE_RELEASEWEBURL;

// provide answers for task mock
let a = {
    "which": {
        "docker": "docker"
    },
     "checkPath": {
        "docker": true
    },
    "exist": {
        "docker": true
    },
    "exec": {
       "docker push test/test:2" : {
           "code": 0,
            "stdout": "successfully pushed test/test:2 image"
       },
       "docker run --rm test/test:2" : {
           "code": 0,
            "stdout": "successfully ran test/test:2 image"
       },
       "docker run --rm -m 2GB test/test:2": {
           "code": 0,
           "stdout": "successfully ran test/test:2 image"
       },
       "docker pull test/test:2": {
           "code": 0,
           "stdout": "successfully pulled test/test:2 image"
       }
    },
    "find": {}
};

// Add extra answer definitions that need to be dynamically generated
a.exist[DockerfilePath] = true;
a.exist[DockerfilePath2] = true;

a.find[`${DefaultWorkingDirectory}`] = [
    `${DockerfilePath}`
]

a.exec[`docker build -f ${DockerfilePath} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath} ${shared.DockerCommandArgs.ReleaseLabels} -t testuser/testrepo:11 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath} ${shared.DockerCommandArgs.BuildLabels} -t testacr.azurecr.io/testrepo:11 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath} ${shared.DockerCommandArgs.BuildLabels} ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath2} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${BuildContextPath2}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${BuildContextPath3}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:tag1 -t testuser/testrepo:tag2 -t testuser/testrepo:tag3 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath} ${shared.DockerCommandArgs.BuildLabels} --rm --queit -t testuser/testrepo:11 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath} ${shared.DockerCommandArgs.BuildLabels} --rm --queit -t testuser/testrepo:11 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker push testuser/testrepo:11`] = {
    "code": 0,
    "stdout": "successfully pushed testuser/testrepo:11."
};

a.exec[`docker push testacr.azurecr.io/testrepo:11`] = {
    "code": 0,
    "stdout": "successfully pushed testacr.azurecr.io/testrepo:11."
};

a.exec[`docker push testuser/testrepo:tag1`] = {
    "code": 0,
    "stdout": "successfully pushed testuser/testrepo:tag1."
};

a.exec[`docker push testuser/testrepo:tag2`] = {
    "code": 0,
    "stdout": "successfully pushed testuser/testrepo:tag2."
};

a.exec[`docker push testuser/testrepo:tag3`] = {
    "code": 0,
    "stdout": "successfully pushed testuser/testrepo:tag3."
};

a.exec[`docker push testuser/testrepo:11 --disable-content-trust --arg2`] = {
    "code": 0,
    "stdout": "successfully pushed testuser/testrepo:11 with arguments --disable-content-trust --arg2."
};

a.exec[`docker push testuser/testrepo:tag1 --disable-content-trust --arg2`] = {
    "code": 0,
    "stdout": "successfully pushed testuser/testrepo:tag1 with arguments --disable-content-trust --arg2."
};

a.exec[`docker push testuser/testrepo:tag2 --disable-content-trust --arg2`] = {
    "code": 0,
    "stdout": "successfully pushed testuser/testrepo:tag2 with arguments --disable-content-trust --arg2."
};

a.exec[`docker push testuser/testrepo:tag3 --disable-content-trust --arg2`] = {
    "code": 0,
    "stdout": "successfully pushed testuser/testrepo:tag3 with arguments --disable-content-trust --arg2."
};

a.exec[`docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:11`] = {
    "code": 0,
    "stdout": ""
};

a.exec[`docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag1`] = {
    "code": 0,
    "stdout": ""
};

a.exec[`docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag2`] = {
    "code": 0,
    "stdout": ""
};

a.exec[`docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag3`] = {
    "code": 0,
    "stdout": ""
};

a.exec[`docker images`] = {
    "code": 0,
    "stdout": "Listed images successfully."
};

a.exec[`docker images --all --digests`] = {
    "code": 0,
    "stdout": "Listed images successfully with args --all --digests."
};

tr.setAnswers(<any>a);

// Create mock for fs module. Required to make the base image name extraction (push command) work.
let fs = require('fs');
let fsClone = Object.assign({}, fs);
fsClone.readFileSync = function(filePath, options) {
    switch (filePath) {
        case DockerfilePath:
        case DockerfilePath2:
            return Dockerfile;
        default:
            return fs.readFileSync(filePath, options);
    }
};
tr.registerMock('fs', fsClone);

tr.run();