import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("action", process.env["action"]);
tr.setInput("ConnectedServiceName", "AzureRM");
tr.setInput("resourceGroupName", process.env["resourceGroupName"]);
tr.setInput("location", "West US");
tr.setInput("templateLocation", "Linked artifact")
tr.setInput("csmFile", process.env["csmFile"]);
tr.setInput("overrideParameters", "");
tr.setInput("deploymentMode","Complete");        
tr.setInput("csmParametersFile", process.env["csmParametersFile"]);
tr.setInput("enableDeploymentPrerequisites", process.env["enableDeploymentPrerequisites"]);
tr.setInput("project", "AzureProj");
tr.setInput("deploymentGroupName", "biprasad");
tr.setInput("copyAzureVMTags", process.env["copyAzureVMTags"]);
tr.setInput("deploymentGroupEndpoint", "PatEndpoint");
tr.setInput("outputVariable", process.env["outputVariable"]);

process.env["ENDPOINT_AUTH_AzureRM"] = "{\"parameters\":{\"serviceprincipalid\":\"id\",\"serviceprincipalkey\":\"key\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID"] = "id";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY"] = "key";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID"] = "sId";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_URL_AzureRM"] = "https://management.azure.com/";
process.env["ENDPOINT_DATA_AzureRM_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
process.env["ENDPOINT_URL_PatEndpoint"] = "https://testking123.visualstudio.com";
process.env["ENDPOINT_DATA_AzureRM_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://management.azure.com";

var CSMJson = path.join(__dirname, "CSM.json");
var CSMwithComments = path.join(__dirname, "CSMwithComments.json");
var defaults = path.join(__dirname, "defaults.json");
var faultyCSM = path.join(__dirname, "faultyCSM.json");

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "findMatch": {
        "CSM.json" : [CSMJson],
        "CSMwithComments.json" : [CSMwithComments],
        "defaults.json" : [defaults],
        "faultyCSM.json" : [faultyCSM],
        "" : [""]
    }
};

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tr.setAnswers(a);

tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
tr.registerMock('azure-arm-rest-v2/webRequestUtility', require('./mock_node_modules/webRequestUtility'));
tr.registerMock('azure-arm-rest-v2/azure-arm-network', require('./mock_node_modules/azure-arm-network'));
tr.registerMock('azure-arm-rest-v2/azure-arm-resource', require('./mock_node_modules/azure-arm-resource'));
tr.registerMock('azure-arm-rest-v2/azure-arm-compute', require('./mock_node_modules/azure-arm-compute'));


tr.run();