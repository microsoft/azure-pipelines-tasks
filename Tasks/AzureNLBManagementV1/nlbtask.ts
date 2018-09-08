import * as tl from 'vsts-task-lib/task';
import * as Q from 'q';
import * as os from 'os';
import * as path from 'path'

var nlbUtility = require('./nlbazureutility');
var utility = require('./utility');

async function run() {
	try {

		tl.setResourcePath(path.join( __dirname, 'task.json'));
		var connectedServiceName = tl.getInput('ConnectedServiceName', true);
		var resourceGroupName: string = tl.getInput("ResourceGroupName", true);
		var loadBalancerName: string = tl.getInput("LoadBalancer", true);
		var action: string = tl.getInput("Action", true);
		var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);
		var endpointUrl = tl.getEndpointUrl(connectedServiceName, true);

		var SPN = new Array();
		SPN["servicePrincipalClientID"] = endPointAuthCreds.parameters["serviceprincipalid"];
		SPN["servicePrincipalKey"] = endPointAuthCreds.parameters["serviceprincipalkey"];
		SPN["tenantID"] = endPointAuthCreds.parameters["tenantid"];
		SPN["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);
		SPN["envAuthUrl"] = tl.getEndpointDataParameter(connectedServiceName, 'environmentAuthorityUrl', true);
		SPN["url"] = tl.getEndpointUrl(connectedServiceName, true);
		
		var nicVm = await getNetworkInterface(SPN, endpointUrl, resourceGroupName);
		tl.debug(`Network Interface - ${nicVm.name}'s configuration details fetched for the virtual machine ${process.env.COMPUTERNAME}`);

		var nicLbBackendPoolConfig = null;
		if (action == "Connect") {
			tl._writeLine(tl.loc("ConnectingVMtoLB", loadBalancerName));
			var lb = await nlbUtility.getLoadBalancer(SPN, endpointUrl, loadBalancerName, resourceGroupName);
			nicLbBackendPoolConfig = lb.properties.backendAddressPools;
		}
		else {
			tl._writeLine(tl.loc("DisconnectingVMfromLB", loadBalancerName));
		}
		nicVm.properties.ipConfigurations[0].properties['loadBalancerBackendAddressPools'] = nicLbBackendPoolConfig;
		var setNIStatus = await nlbUtility.setNetworkInterface(SPN, endpointUrl, nicVm, resourceGroupName);
		tl._writeLine(tl.loc(setNIStatus, nicVm.name));
		tl._writeLine(tl.loc("ActionCompletedSuccefully", action, process.env.COMPUTERNAME, loadBalancerName));
	}
	catch(error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

async function getNetworkInterface(SPN, endpointUrl: string, resourceGroupName: string) {
	var nics =  await nlbUtility.getNetworkInterfacesInRG(SPN, endpointUrl, resourceGroupName);
	tl.debug(`Getting Primary Network Interface for the virtual machine : ${process.env.COMPUTERNAME}`);
	var nicVm = utility.getPrimaryNetworkInterface(nics);
	
	if (!nicVm) {
		throw tl.loc("CouldNotFetchNicDetails", process.env.COMPUTERNAME);	
	}
	return nicVm;
}

run();