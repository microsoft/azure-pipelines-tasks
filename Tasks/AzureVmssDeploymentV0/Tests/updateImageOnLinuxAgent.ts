import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("action", "Update image");
tr.setInput("ConnectedServiceName", "AzureRM");
tr.setInput("vmssName", process.env["noMatchingVmss"] === "true" ? "random-vmss" : (process.env["_vmssOsType_"] === "Linux" ? "testvmss2" : "testvmss1"));
tr.setInput("imageUrl", process.env["imageUrlAlreadyUptoDate"] === "true" ? "http://old-url" : "https://someurl");
if (!(process.env["customScriptNotSpecified"] === "true")) {
    tr.setInput("customScriptsDirectory", "/some/dir with'quote");
    tr.setInput("customScript", process.env["_vmssOsType_"] === "Linux" ? "set V'a`r$.sh" : "de$p`l o'y.ps1");
    tr.setInput("customScriptArguments", "\"first 'arg'\" seco`nd$arg");
    tr.setInput("customScriptsStorageAccount", "teststorage1");
    tr.setInput("skipArchivingCustomScripts", process.env["_doNotArchive_"] === "true" ? "true" : "false");
}

process.env["AZURE_HTTP_USER_AGENT"] = "L0test";
process.env["ENDPOINT_AUTH_AzureRM"] = "{\"parameters\":{\"serviceprincipalid\":\"id\",\"serviceprincipalkey\":\"key\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID"] = "id";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY"] = "key";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID"] = "sId";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_URL_AzureRM"] = "https://management.azure.com/";
process.env["ENDPOINT_DATA_AzureRM_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
process.env["ENDPOINT_DATA_AzureRM_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://login.windows.net/";
process.env["RELEASE_RELEASEID"] = "100";
process.env["RELEASE_ENVIRONMENTID"] = "200";
process.env["RELEASE_ATTEMPTNUMBER"] = "5";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "findMatch": {
        "**/*.*": [
            "/users/temp/vstsvmss12345/folder1/file1",
            "/users/temp/vstsvmss12345/folder1/folder2/file2",
        ]
    },
    "osType": {
        "osType": "Linux"
    }
};

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tr.setAnswers(a);

var os = require('os');
os.tmpdir = function tmpdir() {
    return "/users/temp";
}

Date.now = function (): number {
    return 12345;
}

tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
tr.registerMock('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-compute', require('./mock_node_modules/azure-arm-compute'));
tr.registerMock('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-storage', require('./mock_node_modules/azure-arm-storage'));
tr.registerMock('azp-tasks-az-blobstorage-provider/blobservice', require('./mock_node_modules/blobservice'));
tr.registerMock('azure-pipelines-tasks-utility-common/compressutility', require('./mock_node_modules/compressutility'));

tr.run();