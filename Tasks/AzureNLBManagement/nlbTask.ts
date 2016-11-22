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
		var vmNicMapping: string = tl.getInput("VmNicMapping", false);
		var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);
		var endpointUrl = tl.getEndpointUrl(connectedServiceName, true);

		var SPN = new Array();
		SPN["servicePrincipalClientID"] = endPointAuthCreds.parameters["serviceprincipalid"];
		SPN["servicePrincipalKey"] = endPointAuthCreds.parameters["serviceprincipalkey"];
		SPN["tenantID"] = endPointAuthCreds.parameters["tenantid"];
		SPN["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);

		var nicVm = await getNetworkInterface(SPN, endpointUrl, resourceGroupName, nicDetection, vmNicMapping);
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
	}
	catch(error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

function getLocalIpAddress(): string[] {
	// Return an array of ipv4Addresses 
	var ipv4Address = [];
	var networkInterfaces = os.networkInterfaces();
	Object.keys(networkInterfaces).forEach( (interfaceName) => {
		networkInterfaces[interfaceName].forEach( (interFace) => {
			if (interFace.family !== 'IPv4' || interFace.internal !== false) {
      			return;
    		}
    		ipv4Address.push(interFace.address);
		});
	});
	return ipv4Address;
}

async function getNetworkInterface(SPN, endpointUrl: string, resourceGroupName: string, nicDetection: string, vmNicMapping: string) {
	var nics =  await nlbUtility.getNetworkInterfaces(SPN, endpointUrl, resourceGroupName);
	var ipv4Address = getLocalIpAddress();
	var nicVm = null;
	if(nicDetection == "AutoDetectNic"){
		// Assuming only one NIC per VM i.e. only one ipv4 address per VM
		// Using the ip address of the first network interface
		for (var i in nics) {
			if(nics[i].properties.ipConfigurations[0].properties.privateIPAddress == ipv4Address[0]) {
				nicVm = nics[i];
				break;
			}
		}	
	}
	else {
		// Handle custom vm:nic mapping 
		var nicVmMap = {};	
		var temp = vmNicMapping.split(" ");
		for(var j in temp){
			nicVmMap[temp[j].split(":")[1]] = temp[j].split(":")[0];
		}
		for (var ip in ipv4Address) {
			for (var nic in nics) {
				if(nics[nic].properties.ipConfigurations[0].properties.privateIPAddress == ipv4Address[ip] && nicVmMap[nics[nic].name]) {
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