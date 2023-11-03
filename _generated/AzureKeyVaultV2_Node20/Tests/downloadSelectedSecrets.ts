import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'run.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("ConnectedServiceName", "AzureRMSpn");
tr.setInput("KeyVaultName", "RmCdpKeyVault");
tr.setInput("SecretsFilter", "secret1, secret2, secret3/versionIdentifierGuid, secret5_%3B ");
tr.setInput("RunAsPreJob", "false");

process.env["ENDPOINT_AUTH_SCHEME_AzureRMSpn"] = "ServicePrincipal";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["ENDPOINT_DATA_AzureRMSpn_SPNOBJECTID"] =  "oId";
process.env["ENDPOINT_DATA_AzureRMSpn_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
process.env["ENDPOINT_DATA_AzureRMSpn_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://login.windows.net/";
process.env["ENDPOINT_DATA_AzureRMSpn_GRAPHURL"] = "https://graph.windows.net/";
process.env["ENDPOINT_DATA_AzureRMSpn_AzureKeyVaultServiceEndpointResourceId"] = "https://vault.azure.net";
process.env["ENDPOINT_URL_AzureRMSpn"] = "https://management.azure.com/";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "C:\\a\\w\\";
process.env["AGENT_TEMPDIRECTORY"] = process.cwd();

tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
tr.registerMock('./azure-arm-keyvault', require('./mock_node_modules/azure-arm-keyvault'));

tr.run();