import * as tl from 'azure-pipelines-task-lib/task';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
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
		var action: string = tl.getInput("Action", true);

		var armEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();

		var nicVm = await getNetworkInterface(armEndpoint, resourceGroupName);
		tl.debug(`Network Interface - ${nicVm.name}'s configuration details fetched for the virtual machine ${process.env.COMPUTERNAME}`);

		var nicLbBackendPoolConfig = null;
		if (action == "Connect") {
			taskinternal._writeLine(tl.loc("ConnectingVMtoLB", loadBalancerName));
			var lb = await nlbUtility.getLoadBalancer(armEndpoint, loadBalancerName, resourceGroupName);
			nicLbBackendPoolConfig = lb.properties.backendAddressPools;
		}
		else {
			taskinternal._writeLine(tl.loc("DisconnectingVMfromLB", loadBalancerName));
		}
		nicVm.properties.ipConfigurations[0].properties['loadBalancerBackendAddressPools'] = nicLbBackendPoolConfig;
		var setNIStatus = await nlbUtility.setNetworkInterface(armEndpoint, nicVm, resourceGroupName);
		taskinternal._writeLine(tl.loc(setNIStatus, nicVm.name));
		taskinternal._writeLine(tl.loc("ActionCompletedSuccefully", action, process.env.COMPUTERNAME, loadBalancerName));
	}
	catch(error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

async function getNetworkInterface(endpoint: AzureEndpoint, resourceGroupName: string) {
	var nics =  await nlbUtility.getNetworkInterfacesInRG(endpoint, resourceGroupName);
	tl.debug(`Getting Primary Network Interface for the virtual machine : ${process.env.COMPUTERNAME}`);
	var nicVm = utility.getPrimaryNetworkInterface(nics);

	if (!nicVm) {
		throw tl.loc("CouldNotFetchNicDetails", process.env.COMPUTERNAME);
	}
	return nicVm;
}

run();