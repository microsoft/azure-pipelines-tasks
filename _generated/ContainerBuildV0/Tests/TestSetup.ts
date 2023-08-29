import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as shared from './TestShared';

const DefaultBuildContext: string = shared.formatPath("a/w/**");
const DefaultDockerFileInput = shared.formatPath("a/w/**/Dockerfile");
const DefaultWorkingDirectory: string = shared.formatPath("a/w");
const DockerfilePath: string = shared.formatPath("a/w/Dockerfile");
const BuildctlDockerfilePath: string = `"F:\\a\\w\\meta\\"`;
const BuildctlContextPath: string = `"F:\\a\\w\\context"`;
const DockerfilePath2: string = shared.formatPath("a/w/meta/Dockerfile");
const BuildContextPath: string = shared.formatPath("a/w");
const BuildContextPath2: string = shared.formatPath("a/w/context");
const BuildContextPath3: string = shared.formatPath("a/w/context");
const Dockerfile: string = `FROM ubuntu\nCMD ["echo","Hello World!"]`

let taskPath = path.join(__dirname, '../src', 'buildcontainer.js');

let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
var nock = require("nock");
tr.setInput('dockerRegistryServiceConnection',  process.env[shared.TestEnvVars.dockerRegistryServiceConnection] || "");
tr.setInput('repository',  process.env[shared.TestEnvVars.repository] || "");
tr.setInput('Dockerfile',  process.env[shared.TestEnvVars.dockerFile] || DefaultDockerFileInput);
tr.setInput('buildContext',  process.env[shared.TestEnvVars.buildContext] || DefaultBuildContext);
tr.setInput('tags', process.env[shared.TestEnvVars.tags] || "11");

console.log("Inputs have been set");

process.env["RELEASE_RELEASENAME"] = "Release-1";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  DefaultWorkingDirectory;
process.env["SYSTEM_HOSTTYPE"] = process.env[shared.TestEnvVars.hostType] || shared.HostTypes.build;
process.env["SYSTEM_SERVERTYPE"] = "hosted";
process.env["ENDPOINT_AUTH_dockerhubendpoint"] = "{\"parameters\":{\"username\":\"testuser\", \"password\":\"regpassword\", \"email\":\"testuser1@microsoft.com\",\"registry\":\"https://index.docker.io/v1/\"},\"scheme\":\"UsernamePassword\"}";
// Docker registry endpoint with ACR registrytype
process.env["ENDPOINT_AUTH_PARAMETER_acrendpoint_serviceprincipalid"] = "testspn";
process.env["ENDPOINT_AUTH_PARAMETER_acrendpoint_serviceprincipalkey"] = "acrspnkey";
process.env["ENDPOINT_AUTH_PARAMETER_acrendpoint_loginServer"] = "https://testacr.azurecr.io";
process.env["ENDPOINT_AUTH_PARAMETER_acrendpoint_scheme"] = "ServicePrincipal";
process.env["ENDPOINT_DATA_acrendpoint_registryType"] = "ACR";
// Docker registry endpoint with ACR registrytype containing uppercase characters in registry URL
process.env["ENDPOINT_AUTH_PARAMETER_acrendpoint2_serviceprincipalid"] = "testspn2";
process.env["ENDPOINT_AUTH_PARAMETER_acrendpoint2_serviceprincipalkey"] = "acrspnkey2";
process.env["ENDPOINT_AUTH_PARAMETER_acrendpoint2_loginServer"] = "https://testAcr2.azurecr.io";
process.env["ENDPOINT_AUTH_PARAMETER_acrendpoint2_scheme"] = "ServicePrincipal";
process.env["ENDPOINT_DATA_acrendpoint2_registryType"] = "ACR";

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
        "docker": "docker",
        "buildctl": "buildctl",
        "kubectl": "kubectl",
        "img":"img"
    },
     "checkPath": {
        "docker": true,
        "buildctl": true,
        "kubectl": true,
        "img": true
    },
    "exist": {
        "docker": true,
        "buildctl": true,
        "kubectl": true,
        "img": true
    },
    "exec": {
       "docker push test/test:2" : {
           "code": 0,
            "stdout": "successfully pushed test/test:2 image"
       },
       "buildctl --help" : {
           "code": 0,
           "stdout": "successfully displayed help output"
       },
       "kubectl get service azure-pipelines-pool -o=json" : {
           "code": 0,
           "stdout": "{\"metadata\": {\"namespace\": \"azuredevops\"},\"spec\": {\"clusterIP\": \"10.0.11.12\"},\"status\": {\"loadBalancer\": {\"ingress\": [{\"ip\": \"testip\"}]}}}"
       },
       "kubectl get pods -l=role=buildkit -o=json" : {
           "code": 0,
           "stdout": "{\"apiVersion\": \"v1\",\"items\": [{\"apiVersion\": \"v1\",\"kind\": \"Pod\",\"metadata\": {\"name\": \"buildkitd-0\",\"namespace\": \"azd\"}},{\"apiVersion\": \"v1\",\"kind\": \"Pod\",\"metadata\": {\"name\": \"buildkitd-1\",\"namespace\": \"azd\"}},{\"apiVersion\": \"v1\",\"kind\": \"Pod\",\"metadata\": {\"name\": \"buildkitd-2\",\"namespace\": \"azd\"}}],\"kind\": \"List\"}"
       },
       "kubectl get service azure-pipelines-pool-custom -o=json" : {
        "code": 0,
        "stdout": "{\"metadata\": {\"namespace\": \"azuredevops\"},\"spec\": {\"ports\": [{\"port\": 8080}]},\"status\": {\"loadBalancer\": {\"ingress\": [{\"ip\": \"testip\"}]}}}"
       }
    },
    "find": {}
};

nock('http://10.0.11.12')
    .get('/buildPod')
    .reply(201, {
        status: 'success',
        Message: 'buildkitd-0'
    }).persist();

// Add extra answer definitions that need to be dynamically generated
a.exist[DockerfilePath] = true;
a.exist[DockerfilePath2] = true;

a.find[`${DefaultWorkingDirectory}`] = [
    `${DockerfilePath}`
]

a.exec[`buildctl build --frontend=dockerfile.v0 --local=context=F:\\a\\w\\context --local=dockerfile=F:\\a\\w\\meta\\`] = {
    "code": 0,
    "stdout": "successfully built image using buildctl"
};

a.exec[`docker build -f ${DockerfilePath} -t testacr.azurecr.io/testrepo:11 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testacr.azurecr.io/testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath} -t testacr2.azurecr.io/testrepo:11 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testacr2.azurecr.io/testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath} -t testuser/testrepo:tag1 -t testuser/testrepo:tag2 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:tag1 and testuser/testrepo:tag2."
};

a.exec[`docker build -f ${DockerfilePath} -t testuser/testrepo:tag1 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image using docker and tagged testuser/testrepo:tag1"
};

a.exec[`docker build -f ${DockerfilePath} ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image using docker"
};

a.exec[`docker build -f ${DockerfilePath} -t testuser/testrepo:11 ${BuildContextPath}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath2} -t testuser/testrepo:11 ${BuildContextPath2}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath}  -t testuser/testrepo:11 ${BuildContextPath3}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/testrepo:11."
};

a.exec[`docker build -f ${DockerfilePath}  -t testuser/testrepo:11 ${BuildContextPath}`] = {
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

a.exec[`docker push testacr2.azurecr.io/testrepo:11`] = {
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

a.exec[`buildctl build --frontend=dockerfile.v0 --local=context=F:\\a\\w\\context --local=dockerfile=F:\\a\\w\\meta\\ --exporter=image --exporter-opt=name=testuser/testrepo:11 --exporter-opt=push=true`] = {
    "code": 0,
    "stdout": "successfully built and pushed image using buildctl"
};

a.exec[`buildctl build --frontend=dockerfile.v0 --local=context=F:\\a\\w\\** --local=dockerfile=F:\\a\\w\\**\\ --exporter=image --exporter-opt=name=testuser/testrepo:tag1,testuser/testrepo:tag2 --exporter-opt=push=true`] = {
    "code": 0,
    "stdout": "successfully built and pushed image using buildctl with multiple tags"
};

a.exec[`buildctl build --frontend=dockerfile.v0 --local=context=F:\\a\\w\\** --local=dockerfile=F:\\a\\w\\**\\ --exporter=image --exporter-opt=name=testacr.azurecr.io/testrepo:11 --exporter-opt=push=true`] = {
    "code": 0,
    "stdout": "successfully built and pushed image using buildctl for acr"
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