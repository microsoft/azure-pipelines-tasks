import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const DefaultWorkingDirectory: string = "/a/w";
let taskPath = path.join(__dirname, '..', 'dockercompose.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('containerregistrytype', process.env["__container_type__"] || 'Container Registry');
tr.setInput('action', process.env["__command__"] || 'Build services');
tr.setInput('dockerRegistryEndpoint', 'dockerhubendpoint');
tr.setInput('dockerComposeFile', process.env["__composeFilePath__"] ||'/tmp/tempdir/100/docker-compose.yml');
tr.setInput('customCommand', "pull test/test:2");
tr.setInput('includeLatestTag', process.env["__includeLatestTag__"] || "false");
tr.setInput('qualifyImageNames', process.env["__qualifyImageNames__"] || "false");
tr.setInput('additionalDockerComposeFiles', process.env["__additionalDockerComposeFiles__"] || null);
tr.setInput('dockerComposeCommand', process.env["__dockerComposeCommand__"] || null);
tr.setInput('azureSubscriptionEndpoint', 'AzureRMSpn');
tr.setInput('azureContainerRegistry', '{"loginServer":"ajgtestacr1.azurecr.io", "id" : "/subscriptions/c00d16c7-6c1f-4c03-9be1-6934a4c49682/resourcegroups/ajgtestacr1rg/providers/Microsoft.ContainerRegistry/registries/ajgtestacr1"}');
tr.setInput('arguments', process.env["__arguments__"] || '');
tr.setInput('dockerComposePath', process.env["__dockerComposePath__"] || '');

console.log("Inputs have been set");

process.env["RELEASE_RELEASENAME"] = "Release-1";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  DefaultWorkingDirectory;
process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://abc.visualstudio.com/";
process.env["SYSTEM_SERVERTYPE"] = "hosted";
process.env["ENDPOINT_AUTH_dockerhubendpoint"] = "{\"parameters\":{\"username\":\"test\", \"password\":\"regpassword\", \"email\":\"test@microsoft.com\",\"registry\":\"https://index.docker.io/v1/\"},\"scheme\":\"UsernamePassword\"}";
process.env["ENDPOINT_AUTH_SCHEME_AzureRMSpn"] = "ServicePrincipal";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["ENDPOINT_DATA_AzureRMSpn_SPNOBJECTID"] =  "oId";
process.env['AGENT_HOMEDIRECTORY'] = '/tmp/tempdir/100/';

// provide answers for task mock
let a: any = <any>{
    "which": {
        "docker": "docker",
        "docker-compose": "docker-compose"
    },
    "checkPath": {
        "docker": true,
        "docker-compose": true
    },
    "exec": {
        "docker-compose -f /tmp/tempdir/100/docker-compose.yml build" :{
            "code": 0,
            "stdout": "sucessfully built the service images"
        },
        "docker-compose -f /tmp/tempdir/100/docker-compose.yml config" :{
            "code": 0,
            "stdout": "services:\n  redis:\n    image: redis:alpine\n  web:\n    build:\n      context: /tmp/tempdir/100\n    ports:\n    - 5000:5000/tcp\n    volumes:\n    - /tmp/tempdir/100:/code:rw\nversion: '2.0'"
        },
        "docker push 100_web": {
            "code": 0,
            "stdout": "sucessfully pushed 100_web"
        },
        "docker-compose -f /tmp/tempdir/100/docker-compose.yml up": {
            "code": 0,
            "stdout": "sucessfully ran services"
        },
        "docker-compose -f /tmp/tempdir/100/docker-compose.yml -f /tmp/tempdir/100/.docker-compose.12345.yml config":{
            "code": 0,
            "stdout": "services:\n  redis:\n    image: redis:alpine\n  web:\n    build:\n      context: /tmp/tempdir/100\n    image: ajgtestacr1.azurecr.io/100_web\n    ports:\n    - 5000:5000/tcp\n    volumes:\n    - /tmp/tempdir/100:/code:rw\nversion: '2.0'"
        },
        "docker push ajgtestacr1.azurecr.io/100_web":{
            "code": 0,
            "stdout": "successfully pushed with qualified image"
        },
        "docker-compose -f /tmp/tempdir/100/docker-compose.yml -f /tmp/tempdir/100/docker-compose.override.yml config":{
            "code": 0,
            "stdout": "services:\n  redis:\n    image: redis:alpine\n  web:\n    build:\n      context: /tmp/tempdir/100\n    image: ajgtestacr1.azurecr.io/100_web\n    ports:\n    - 5000:5000/tcp\n    volumes:\n    - /tmp/tempdir/100:/code:rw\nversion: '2.0'"
        },
        "docker-compose -f /tmp/tempdir/100/docker-compose.yml -f /tmp/tempdir/100/docker-compose.override.yml up -d":{
            "code": 0,
            "stdout": "successfully ran up command"
        },
        "docker-compose -f /tmp/tempdir/100/docker-compose.yml up -d":{
            "code": 0,
            "stdout": "successfully ran up command"
        },
        "docker-compose -f /tmp/tempdir/100/docker-compose.yml build --pull --parallel" :{
            "code": 0,
            "stdout": "sucessfully built the service images"
        },
        "docker-compose-userdefined -f /tmp/tempdir/100/docker-compose.yml build" :{
            "code": 0,
            "stdout": "sucessfully built the service images"
        }, "docker-compose-userdefined -f /tmp/tempdir/100/docker-compose.yml config" :{
            "code": 0,
            "stdout": "services:\n  redis:\n    image: redis:alpine\n  web:\n    build:\n      context: /tmp/tempdir/100\n    ports:\n    - 5000:5000/tcp\n    volumes:\n    - /tmp/tempdir/100:/code:rw\nversion: '2.0'"
        }, "docker-compose -f /tmp/tempdir/100/docker-compose.yml pull service1 service2" :{
            "code": 0,
            "stdout": "successfully pulled the passed service images"
        }
    },
    "exist": {
        "/tmp/tempdir/100/.docker-compose.12345.yml" : true,
        "/tmp/tempdir/100/docker-compose.override.yml" : true
    } 
};

var ut = require('../utils');
tr.registerMock('./utils', {
    IsNullOrEmpty : ut.IsNullOrEmpty,
    HasItems : ut.HasItems,
    StringWritable: ut.StringWritable,
    PackerVersion: ut.PackerVersion,
    isGreaterVersion: ut.isGreaterVersion,
    getFinalComposeFileName: function(){
        return ".docker-compose.12345" + ".yml";
    },
    writeFileSync: function(filename: string, data: any, options?: { encoding?: string; mode?: number; flag?: string; }){
        console.log("content of yaml file : "+data);
    },
    writeTaskOutput: function (commandName: string, output: string): string {
        let outputFileName = commandName + "_" + Date.now() + ".txt";
        console.log(`Mocked test writing to: ${outputFileName}`);
        return outputFileName;
    }
});

tr.setAnswers(a);
tr.run();