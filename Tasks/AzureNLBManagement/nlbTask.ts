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
		var action: string = tl.getInput("Action", true);
		var nicDetection: string = tl.getInput("NICDetection", true);		
		var inputNics: string = tl.getInput("inputNics", false);
		var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);
		var endpointUrl = tl.getEndpointUrl(connectedServiceName, true);

		var SPN = new Array();
		SPN["servicePrincipalClientID"] = endPointAuthCreds.parameters["serviceprincipalid"];
		SPN["servicePrincipalKey"] = endPointAuthCreds.parameters["serviceprincipalkey"];
		SPN["tenantID"] = endPointAuthCreds.parameters["tenantid"];
		SPN["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);

		var nicVm = await getNetworkInterface(SPN, endpointUrl, resourceGroupName, nicDetection, inputNics);
		tl.debug(tl.loc("NicDetailsFetched", process.env["computername"]));

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
		tl._writeLine(tl.loc("ActionCompletedSuccefully", action, process.env.computername, loadBalancerName));
	}
	catch(error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

function getMacAddress(): string[] {
	// Return an array of mac address of all the network interfaces 
	var macAddress = [];
	var networkInterfaces = os.networkInterfaces();
	Object.keys(networkInterfaces).forEach( (interfaceName) => {
		networkInterfaces[interfaceName].forEach( (interFace) => {
			if (interFace.family !== 'IPv4' || interFace.internal !== false) {
      			return;
    		}
    		macAddress.push(interFace.mac.toUpperCase().replace(/:/g, "-"));
		});
	});
	return macAddress;
}

async function getNetworkInterface(SPN, endpointUrl: string, resourceGroupName: string, nicDetection: string, inputNics: string) {
	var nics =  await nlbUtility.getNetworkInterfacesInRG(SPN, endpointUrl, resourceGroupName);
	var macAddress = getMacAddress();
	var nicVm = null;
	if(nicDetection == "AutoDetectNic"){
		tl.debug(tl.loc("GettingPrimaryNicForVm", process.env.computername));
		for (var mac in macAddress) {
			for (var i in nics) {
				if(nics[i].properties.macAddress == macAddress[mac] && nics[i].properties.primary) {
					nicVm = nics[i];
					break;
				}
			}	
		}
	}
	else {
		inputNics = inputNics.trim().replace(/,\s*/g, ",").replace(/\s*,/g, ",");
		var userNics = inputNics.split(",");
		for (var mac in macAddress) {
			for (var nic in nics) {
				if(nics[nic].properties.macAddress == macAddress[mac] && userNics.indexOf(nics[nic].name) != -1) {
					nicVm = nics[nic];
					break;
				}
			}
		}
	}
	
	if (nicVm == null) {
		throw tl.loc("CouldNotFetchNicDetails", process.env["computername"]);	
	}
	return nicVm;
}

run();