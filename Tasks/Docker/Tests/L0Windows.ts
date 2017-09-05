import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

const DefaultWorkingDirectory: string = "C:\\a\\w\\";
let taskPath = path.join(__dirname, '..\\container.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('containerregistrytype', process.env["__container_type__"] || 'Container Registry');
tr.setInput('action', process.env["__command__"] || 'Build an image');
tr.setInput('imageName', 'test/test:2');
tr.setInput('dockerRegistryEndpoint', 'dockerhubendpoint');
tr.setInput('dockerFile', 'F:\\dir1\\DockerFile');
tr.setInput('customCommand', "pull test/test:2");
tr.setInput('includeLatestTag', process.env["__includeLatestTag__"] || "false");
tr.setInput('qualifyImageName', process.env["__qualifyImageName__"] || "false");
tr.setInput('azureSubscriptionEndpoint', 'AzureRMSpn');
tr.setInput('azureContainerRegistry', '{"loginServer":"ajgtestacr1.azurecr.io", "id" : "/subscriptions/c00d16c7-6c1f-4c03-9be1-6934a4c49682/resourcegroups/ajgtestacr1rg/providers/Microsoft.ContainerRegistry/registries/ajgtestacr1"}')

console.log("Inputs have been set");

process.env["RELEASE_RELEASENAME"] = "Release-1";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  DefaultWorkingDirectory;
process.env["ENDPOINT_AUTH_dockerhubendpoint"] = "{\"parameters\":{\"username\":\"test\", \"password\":\"regpassword\", \"email\":\"test@microsoft.com\",\"registry\":\"https://index.docker.io/v1/\"},\"scheme\":\"UsernamePassword\"}";
process.env["ENDPOINT_AUTH_SCHEME_AzureRMSpn"] = "ServicePrincipal";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["ENDPOINT_DATA_AzureRMSpn_SPNOBJECTID"] =  "oId";

// provide answers for task mock
let a: any = <any>{
    "which": {
        "docker": "docker"
    },
     "checkPath": {
        "docker": true
    },
    "exist": {
        "F:\\dir1\\DockerFile": true,
        "docker": true       
    },
    "exec": {
        "docker build -f F:\\dir1\\DockerFile -t test/test:2" :{
            "code": 0,
            "stdout": "successfully build test/test:2 image"
        },
       "docker push test/test:2" : {
           "code": 0,
            "stdout": "successfully pushed test/test:2 image"
       },
       "docker run --rm test/test:2" : {
           "code": 0,
            "stdout": "successfully ran test/test:2 image"
       },
       "docker pull test/test:2": {
           "code": 0,
           "stdout": "successfully pulled test/test:2 image"
       },
       "docker build -f F:\\dir1\\DockerFile -t test/test:2 -t test/test" :{
           "code": 0,
           "stdout": "successfully build test/test image with latest tag"
       },
       "docker build -f F:\\dir1\\DockerFile -t ajgtestacr1.azurecr.io/test/test:2":{
           "code": 0,
           "stdout": "successfully build ajgtestacr1.azurecr.io/test/test image with latest tag"
       }
    }
};

tr.setAnswers(a);
tr.run();