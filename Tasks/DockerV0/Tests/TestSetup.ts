import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as shared from './TestShared';

const DefaultWorkingDirectory: string = shared.formatPath("a/w");
const ImageNamesPath = shared.formatPath("dir/image_names.txt");
const DockerFilePath = shared.formatPath('dir1/DockerFile');
const Dockerfile: string = `FROM ubuntu\nCMD ["echo","Hello World!"]`

let taskPath = path.join(__dirname, '..', 'container.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('containerregistrytype', process.env[shared.TestEnvVars.containerType] || shared.ContainerTypes.ContainerRegistry);
tr.setInput('action', process.env[shared.TestEnvVars.action] || shared.ActionTypes.buildImage);
tr.setInput('imageName', process.env[shared.TestEnvVars.imageName] || 'test/test:2');
tr.setInput('imageNamesPath', ImageNamesPath);
tr.setInput('dockerRegistryEndpoint', 'dockerhubendpoint');
tr.setInput('dockerFile', DockerFilePath);
tr.setInput('customCommand', "pull test/test:2");
tr.setInput('includeLatestTag', process.env[shared.TestEnvVars.includeLatestTag] || "false");
tr.setInput('qualifyImageName', process.env[shared.TestEnvVars.qualifyImageName] || "false");
tr.setInput('azureSubscriptionEndpoint', 'AzureRMSpn');
tr.setInput('azureContainerRegistry', '{"loginServer":"ajgtestacr1.azurecr.io", "id" : "/subscriptions/c00d16c7-6c1f-4c03-9be1-6934a4c49682/resourcegroups/ajgtestacr1rg/providers/Microsoft.ContainerRegistry/registries/ajgtestacr1"}')
tr.setInput('additionalImageTags', process.env[shared.TestEnvVars.additionalImageTags] || '');
tr.setInput('enforceDockerNamingConvention', process.env[shared.TestEnvVars.enforceDockerNamingConvention]);
tr.setInput('memory', process.env[shared.TestEnvVars.memory] || '');
tr.setInput ('addBaseImageData', process.env[shared.TestEnvVars.addBaseImageData] || "true");

console.log("Inputs have been set");

process.env["SYSTEM_HOSTTYPE"] = "__hostType__";
process.env["RELEASE_RELEASENAME"] = "Release-1";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  DefaultWorkingDirectory;
process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = shared.teamFoundationCollectionURI;
process.env["SYSTEM_SERVERTYPE"] = "hosted";
process.env["ENDPOINT_AUTH_dockerhubendpoint"] = "{\"parameters\":{\"username\":\"test\", \"password\":\"regpassword\", \"email\":\"test@microsoft.com\",\"registry\":\"https://index.docker.io/v1/\"},\"scheme\":\"UsernamePassword\"}";
process.env["ENDPOINT_AUTH_SCHEME_AzureRMSpn"] = "ServicePrincipal";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["ENDPOINT_DATA_AzureRMSpn_SPNOBJECTID"] =  "oId";

// provide answers for task mock
let a = {
    "which": {
        "docker": "docker"
    },
     "checkPath": {
        "docker": true,
        [ImageNamesPath]: true
    },
    "exist": {
        "docker": true,
        [ImageNamesPath]: true
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
    }
};

// Add extra answer definitions that need to be dynamically generated
a.exist[DockerFilePath] = true;

a.exec[`docker build -f ${DockerFilePath} -t test/test:2 ${shared.DockerCommandArgs.BuildLabels}`] = {
    "code": 0,
    "stdout": "successfully build test/test:2 image"
};
a.exec[`docker build -f ${DockerFilePath} -t test/test:2 -m 2GB ${shared.DockerCommandArgs.BuildLabels}`] = {
    "code": 0,
    "stdout": "successfully build test/test:2 image"
};
a.exec[`docker build -f ${DockerFilePath} -t test/Te st:2 ${shared.DockerCommandArgs.BuildLabels}`] = {
    "code": 1,
    "stdout": "test/Te st:2 not valid imagename"
};
a.exec[`docker build -f ${DockerFilePath} -t test/test:2 -t test/test ${shared.DockerCommandArgs.BuildLabels}`] = {
    "code": 0,
    "stdout": "successfully build test/test image with latest tag"
};
a.exec[`docker build -f ${DockerFilePath} -t ajgtestacr1.azurecr.io/test/test:2 ${shared.DockerCommandArgs.BuildLabels}`] = {
    "code": 0,
    "stdout": "successfully build ajgtestacr1.azurecr.io/test/test image with latest tag"
};
a.exec[`docker build -f ${DockerFilePath} -t ${shared.ImageNamesFileImageName} ${shared.DockerCommandArgs.BuildLabels}`] = {
    "code": 0
};
a.exec[`docker tag test/test:2 ajgtestacr1.azurecr.io/test/test:2`] = {
    "code": 0
};
a.exec[`docker tag ${shared.ImageNamesFileImageName} ajgtestacr1.azurecr.io/${shared.ImageNamesFileImageName}:latest`] = {
    "code": 0
};
a.exec[`docker run --rm ${shared.ImageNamesFileImageName}`] = {
    "code": 0
};
a.exec[`docker push ${shared.ImageNamesFileImageName}:latest`] = {
    "code": 0
};
a.exec[`docker build -f ${DockerFilePath} -t test/test:2 -t test/test:6 ${shared.DockerCommandArgs.BuildLabels}`] = {
    "code": 0,
    "stdout": "successfully build test/test:2 and test/test:6 image"
};
a.exec[`docker build -f ${DockerFilePath} -t testuser/standardbuild:11 ${shared.DockerCommandArgs.BuildLabels}`] = {
    "code": 0,
    "stdout": "Successfully built c834e0094587\n Successfully tagged testuser/testrepo:11."
};
a.exec[`docker build -f ${DockerFilePath} -t testuser/buildkit:11 ${shared.DockerCommandArgs.BuildLabels}`] = {
    "code": 0,
    "stdout": " => => writing image sha256:6c3ada3eb42094510e0083bba6ae805540e36c96871d7be0c926b2f8cbeea68c\n => => naming to docker.io/library/testuser/buildkit:11"
};
a.exec[`docker build -f ${DockerFilePath} -t testuser/imagewithannotations:11 ${shared.DockerCommandArgs.BuildLabels} --label ${shared.BaseImageLabels.name} --label ${shared.BaseImageLabels.digest}`] = {
    "code": 0,
    "stdout": "successfully built image and tagged testuser/imagewithannotations:11."
};
a.exec[`docker pull ${shared.BaseImageName}`] = {
    "code":0,
    "stdout": "Pull complete"
};
a.exec[`docker inspect ${shared.BaseImageName}`] = {
    "code":0,
    "stdout": `[{
        "Id": "sha256:302aba9ce190db9e247d710f4794cc303b169035de2048e76b82c9edbddbef4e",
        "RepoTags": [
            "alpine:latest"
        ],
        "RepoDigests": [
            "ubuntu@sha256:826f70e0ac33e99a72cf20fb0571245a8fee52d68cb26d8bc58e53bfa65dcdfa"
        ]
    }]`
};
tr.setAnswers(<any>a);

// Create mock for fs module
let fs = require('fs');
let fsClone = Object.assign({}, fs);
fsClone.readFileSync = function(filePath, options) {
    switch (filePath) {
        case ImageNamesPath:
            return shared.ImageNamesFileImageName;
        case DockerFilePath:
            return Dockerfile;
        default:
            return fs.readFileSync(filePath, options);
    }
};
tr.registerMock('fs', fsClone);

tr.run();