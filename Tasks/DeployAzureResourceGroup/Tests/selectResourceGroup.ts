import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("action", "Select resource group");
tr.setInput("ConnectedServiceName", "AzureRM");
tr.setInput("resourceGroupName", "AzureRM");
tr.setInput("outputVariable", process.env["outputVariable"]);

process.env[ "ENDPOINT_AUTH_AzureRM"] = "{\"parameters\":{\"serviceprincipalid\":\"id\",\"serviceprincipalkey\":\"key\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID"] = "sId";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONNAME"] = "sName";

tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));
tr.registerMock('azure-arm-resource', require('./mock_node_modules/azure-arm-resource'));
tr.registerMock('azure-arm-compute', require('./mock_node_modules/azure-arm-compute'));
tr.registerMock('azure-arm-network', require('./mock_node_modules/azure-arm-network'));
tr.run();