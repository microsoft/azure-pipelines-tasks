import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("action", "Select Resource Group");
tr.setInput("ConnectedServiceName", "AzureRM");
tr.setInput("resourceGroupName", "AzureRM");
tr.setInput("outputVariable", process.env["outputVariable"]);
tr.setInput("enableDeploymentPrerequisites", "None"); 

process.env[ "ENDPOINT_AUTH_AzureRM"] = "{\"parameters\":{\"serviceprincipalid\":\"id\",\"serviceprincipalkey\":\"key\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID"] = "id";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY"] = "key";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID"] = "sId";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_URL_AzureRM"] = "https://management.azure.com/";
process.env["ENDPOINT_DATA_AzureRM_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
process.env["ENDPOINT_DATA_AzureRM_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://management.azure.com";

tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
tr.registerMock('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-resource', require('./mock_node_modules/azure-arm-resource'));
tr.registerMock('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-compute', require('./mock_node_modules/azure-arm-compute'));
tr.registerMock('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-network', require('./mock_node_modules/azure-arm-network'));
tr.run();