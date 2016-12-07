import  * as ma from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';
import * as path from 'path';

let taskPath = path.join(__dirname, '..', 'nlbtask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('ConnectedServiceName', 'AzureRMSpn');
tmr.setInput("ResourceGroupName", "testRG");
tmr.setInput("LoadBalancer", "testLB");
tmr.setInput("Action", "Disconnect");

process.env["ENDPOINT_AUTH_AzureRMSpn"] = "{\"parameters\":{\"serviceprincipalid\":\"spId\",\"serviceprincipalkey\":\"spKey\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["AZURE_HTTP_USER_AGENT"] = "TFS_useragent";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";
process.env["COMPUTERNAME"] = "test-vm";

var tl = require('vsts-task-lib/mock-task');
tmr.registerMock('./nlbazureutility', {
	getNetworkInterfacesInRG: function(SPN, endpointUrl, resourceGroupName) {
		return [
			{
			    "name": "test-nic1",
			    "id": "test-nic1-id",
			    "properties": {
			        "provisioningState": "Succeeded",
			        "ipConfigurations": [{
			            "name": "test-ipconfig1",
			            "id":"test-ipconfig1-id",
			            "properties": {
			                "provisioningState": "Succeeded",
			                "privateIPAddress": "test-privateip1",
			                "loadBalancerBackendAddressPools": [
			                {
			                    "id" : "xlr8lb-id"
			                }],
			                "loadBalancerInboundNatRules": [
			                {
			                    "id": "xlr8lb-inboundNatRules-RDP1"
			                }]
			            }
			        }],
			        "macAddress": "mac-nic1",
			        "primary": true,
			    }
			},
			{   "name": "test-nic2",
			    "id": "test-nic2-id",
			    "properties": {
			        "provisioningState": "Succeeded",
			        "ipConfigurations": [{
			            "name": "test-ipconfig2",
			            "id":"test-ipconfig2-id",
			            "properties": {
			                "privateIPAddress": "test-privateip2",
			                "loadBalancerBackendAddressPools": [
			                {
			                    "id": "xlr8lb-id"
			                }],
			                "loadBalancerInboundNatRules": [
			                {
			                    "id": "xlr8lb-inboundNatRules-RDP2"
			                }]
			            }
			        }],
			        "macAddress": "mac-nic2",
			        "primary": false,
			        "virtualMachine": {
			            "id": "test-vm2"
			        }
			    }
			},
			{   "name": "test-nic3",
			    "id": "test-nic3-id",
			    "properties": {
			        "provisioningState": "Succeeded",
			        "ipConfigurations": [{
			            "name": "test-ipconfig3",
			            "id":"test-ipconfig3-id",
			            "properties": {
			                "privateIPAddress": "test-privateip3",
			                "loadBalancerBackendAddressPools": [
			                {
			                    "id": "xlr8lb-id"
			                }],
			                "loadBalancerInboundNatRules": [
			                {
			                    "id": "xlr8lb-inboundNatRules-RDP3"
			                }]
			            }
			        }],
			        "macAddress": "mac-nic3",
			        "primary": true,
			        "virtualMachine": {
			            "id": "test-vm3"
			        }
			    }
			}
		];
	},
	setNetworkInterface: function(SPN, endpointUrl, nic, resourceGroupName) {
		tl._writeLine(tl.loc("SettingTheNetworkInterface"));
		return "setNICStatusSuccess";
	}
});

var utility = require('../utility');
tmr.registerMock("./utility", {
	getMacAddress: function () {
		return ["mac-nic1", "mac-nic2"];
	},
	getPrimaryNetworkInterface: utility.getPrimaryNetworkInterface
});

tmr.run();
