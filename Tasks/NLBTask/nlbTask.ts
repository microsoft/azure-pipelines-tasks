import * as tl from 'vsts-task-lib/task';
import * as Q from 'q';
import * as os from 'os';
import * as path from 'path'

var nlbUtility = require('./nlbUtility');

async function run() {
	try {

		tl.setResourcePath(path.join( __dirname, 'task.json'));
		var connectedServiceName = tl.getInput('ConnectedServiceName', true);
		var resourceGroupName: string = tl.getInput("ResourceGroupName", true);
		var loadBalancerName: string = tl.getInput("LoadBalancer", true);
		var operation: string = tl.getInput("Operation", true);
		var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);
		var endpointUrl = tl.getEndpointUrl(connectedServiceName, true);

		var SPN = new Array();
		SPN["servicePrincipalClientID"] = endPointAuthCreds.parameters["serviceprincipalid"];
		SPN["servicePrincipalKey"] = endPointAuthCreds.parameters["serviceprincipalkey"];
		SPN["tenantID"] = endPointAuthCreds.parameters["tenantid"];
		SPN["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);

		var nicVm = await getNetworkInterface(SPN, endpointUrl, resourceGroupName);
		tl.debug(tl.loc("NicDetailsFetched", process.env["computername"]));

		var obj = null;
		if (operation == "Add") {
			tl._writeLine("Adding VM to LB");
			var lb = await nlbUtility.getLoadBalancer(SPN, endpointUrl, resourceGroupName, loadBalancerName);
			obj = lb.properties.backendAddressPools;
		}
		else {
			tl._writeLine("Removing VM from LB");
		}
		nicVm.properties.ipConfigurations[0].properties['loadBalancerBackendAddressPools'] = obj;
		var status = await nlbUtility.setNetworkInterface(SPN, endpointUrl, nicVm, resourceGroupName);
		tl._writeLine(status);
	}
	catch(error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

function getLocalIpAddress(): string {
	var ipv4Address = "";
	var networkInterfaces = os.networkInterfaces();
	Object.keys(networkInterfaces).forEach( (interfaceName) => {
		networkInterfaces[interfaceName].forEach( (interFace) => {
			if (interFace.family !== 'IPv4' || interFace.internal !== false) {
      			return;
    		}
    		ipv4Address = interFace.address;
		});
	});
	return ipv4Address;
}

async function getNetworkInterface(SPN, endpointUrl: string, resourceGroupName: string) {
	var nics =  await nlbUtility.getNetworkInterfaces(SPN, endpointUrl, resourceGroupName);
	var ipv4Address = getLocalIpAddress();
	tl.debug("Local IPv4 Address : " + ipv4Address);
	var nicVm = null;
	for (var i in nics) {
		if(nics[i].properties.ipConfigurations[0].properties.privateIPAddress == ipv4Address) {
			nicVm = nics[i];
			break;
		}
	}
	if (nicVm == null) {
		throw tl.loc("CouldNotFetchNicDetails", process.env["computername"]);	
	}
	return nicVm;
}

run();