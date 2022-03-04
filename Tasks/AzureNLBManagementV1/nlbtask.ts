import * as tl from 'azure-pipelines-task-lib/task';
import taskinternal = require('azure-pipelines-task-lib/internal');
import * as path from 'path'

var nlbUtility = require('./nlbazureutility');
var utility = require('./utility');

async function run() {
	try {

		tl.setResourcePath(path.join( __dirname, 'task.json'));
		var connectedServiceName = tl.getInput('ConnectedServiceName', true);
		var resourceGroupName: string = tl.getInput("ResourceGroupName", true);
		var loadBalancerName: string = tl.getInput("LoadBalancer", true);
		var backendPoolName: string = tl.getInput("BackEndPool");
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
		var currentBackendPools = nicVm.properties.ipConfigurations[0].properties['loadBalancerBackendAddressPools'];

		// specify the id of the load balancer/pool to add
		var poolId = `/subscriptions/${SPN.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Network/loadBalancers/${loadBalancerName}/backendAddressPools/`;

		if (action == "Connect") {

			taskinternal._writeLine(tl.loc("ConnectingVMtoLB", loadBalancerName));

			var lb = await nlbUtility.getLoadBalancer(SPN, endpointUrl, loadBalancerName, resourceGroupName);
			var backendAddressPools = lb.properties.backendAddressPools;
			
			poolId += backendPoolName
			
			// filter to the selected load balancer and backend pool name if provided
			backendAddressPools = backendAddressPools.filter(pool => pool.id.startsWith(poolId) && !currentBackendPools.some(p => p.id == pool.id))

			// merge the existing and new backend address pools
			nicLbBackendPoolConfig = [...currentBackendPools, ...backendAddressPools];
		}
		else {
			taskinternal._writeLine(tl.loc("DisconnectingVMfromLB", loadBalancerName));

			nicLbBackendPoolConfig = currentBackendPools.filter(pool => {
				return !(pool.id.startsWith(poolId) && (backendPoolName == null || pool.id.endsWith(backendPoolName)));
			});
		}

		nicVm.properties.ipConfigurations[0].properties['loadBalancerBackendAddressPools'] = nicLbBackendPoolConfig;
		var setNIStatus = await nlbUtility.setNetworkInterface(SPN, endpointUrl, nicVm, resourceGroupName);
		taskinternal._writeLine(tl.loc(setNIStatus, nicVm.name));
		taskinternal._writeLine(tl.loc("ActionCompletedSuccefully", action, process.env.COMPUTERNAME, loadBalancerName));
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