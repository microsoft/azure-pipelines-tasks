import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("action", process.env["operation"]);
tr.setInput("ConnectedServiceName", "AzureRM");
tr.setInput("resourceGroupName", "dummy");

process.env[ "ENDPOINT_AUTH_AzureRM"] = "{\"parameters\":{\"serviceprincipalid\":\"id\",\"serviceprincipalkey\":\"key\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID"] = "sId";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONNAME"] = "sName";

process.env["__mg__internal__collection__uri"] = "https://testking123.visualstudio.com";
process.env["__mg__internal__project__name"] = "AzureProj";

tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));
tr.registerMock('./azure-rest/azure-arm-compute', require('./mock_node_modules/azure-arm-compute'));
tr.run();