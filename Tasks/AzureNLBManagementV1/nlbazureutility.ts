import * as tl from 'azure-pipelines-task-lib/task';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import taskinternal = require('azure-pipelines-task-lib/internal');
import * as Q from 'q';
import * as httpClient from 'vso-node-api/HttpClient';

var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var azureApiVersion = '2016-09-01';

export async function getNetworkInterfacesInRG(endpoint: AzureEndpoint, resourceGroupName: string) {

	var deferred = Q.defer<any>();
	var restUrl = endpoint.url + "subscriptions/" + endpoint.subscriptionID + "/resourceGroups/" + resourceGroupName + "/providers/Microsoft.Network/networkInterfaces?api-version=" + azureApiVersion;
	var accessToken = await endpoint.applicationTokenCredentials.getToken();

	var requestHeader = {
		Authorization: 'Bearer ' + accessToken
	};

	tl.debug(`Getting all network interfaces in the resource group ${resourceGroupName}`);
	httpObj.get('GET', restUrl, requestHeader, (error, response, body) => {
		if(error) {
			deferred.reject(error);
		}
		else if(response.statusCode == 200) {
			deferred.resolve(JSON.parse(body).value);
		}
		else {
			deferred.reject(tl.loc("CouldNotFetchNetworkInterfacesInRg", resourceGroupName, response.statusCode, response.statusMessage, body));
		}

	});
	return deferred.promise;
}

export async function getLoadBalancer(endpoint: AzureEndpoint, name: string, resourceGroupName: string) {

	var deferred = Q.defer<any>();
	var restUrl = endpoint.url + "subscriptions/" + endpoint.subscriptionID + "/resourceGroups/" + resourceGroupName + "/providers/Microsoft.Network/loadBalancers/" + name + "?api-version=" + azureApiVersion;
	var accessToken = await endpoint.applicationTokenCredentials.getToken();

	var requestHeader = {
		authorization: 'Bearer ' + accessToken
	}

	tl.debug(`Getting the load balancer: ${name}`);
	httpObj.get('GET', restUrl, requestHeader, (error, response, body) => {
        if(error) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            deferred.resolve(JSON.parse(body));
        }
        else {
        	deferred.reject(tl.loc("CouldNotFetchLoadBalancer", name, response.statusCode, response.statusMessage, body));
        }
    });

    return deferred.promise;
}

export async function getNetworkInterface(endpoint: AzureEndpoint, name: string, resourceGroupName: string) {
	var deferred = Q.defer<any>();
	var restUrl = endpoint.url + "subscriptions/" + endpoint.subscriptionID + "/resourceGroups/" + resourceGroupName + "/providers/Microsoft.Network/networkInterfaces/" + name + "?api-version=" + azureApiVersion;
	var accessToken = await endpoint.applicationTokenCredentials.getToken();

	var requestHeader = {
		authorization: 'Bearer ' + accessToken
	}

	tl.debug(`Getting the Network Interface: ${name}`);
	httpObj.get('GET', restUrl, requestHeader, (error, response, body) => {
        if(error) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            deferred.resolve(JSON.parse(body));
        }
        else {
        	deferred.reject(tl.loc("CouldNotFetchNetworkInterface", name, response.statusCode, response.statusMessage, body));
        }
    });

    return deferred.promise;
}

async function checkProvisioningState(url: string, accessToken: string) {
	var deferred = Q.defer();
	var headers = {
		Authorization: "Bearer " + accessToken
	};
	httpObj.get("GET", url, headers, (error, response, body) => {
		if(error){
			deferred.reject(error);
		}
		else if(response.statusCode == 200) {
			deferred.resolve(JSON.parse(body).status);
		}
		else {
			deferred.reject(body);
		}
	});
	return deferred.promise;
}

export async function setNetworkInterface(endpoint: AzureEndpoint, nic, resourceGroupName: string){

	var deferred = Q.defer();
	var restUrl = endpoint.url + "subscriptions/" + endpoint.subscriptionID + "/resourceGroups/" + resourceGroupName + "/providers/Microsoft.Network/networkInterfaces/" + nic.name + "?api-version=" + azureApiVersion;
	var accessToken = await endpoint.applicationTokenCredentials.getToken();
	var requestHeader = {
		"Content-Type": "application/json; charset=utf-8",
		"Authorization": 'Bearer ' + accessToken
	};

	taskinternal._writeLine(tl.loc("SettingTheNetworkInterface", nic.name));
	var maxRetries = 10;
	var sleepTime = (Math.floor(Math.random() * 6) + 5) * 1000;	// sleep time in ms
	var retryCount = 1;

	setTimeout (function putNetworkInterface() {
		if(retryCount > maxRetries) {
			deferred.reject(tl.loc("MaxRetriesExceededForSettingNetworkInterface", nic.name));
			return;
		}

		tl.debug(`Trial Count = ${retryCount}`);
		httpObj.send("PUT", restUrl, JSON.stringify(nic, null, 2), requestHeader, (error, response, body) => {
	        if(error) {
	            deferred.reject(error);
	        }
	        else if(response.statusCode == 200) {

	        	// wait for the provisioning state to be succeeded
	        	// check after every 20 seconds
	        	var asyncUrl = response.headers["azure-asyncoperation"].toString();
	        	var checkStatusRetryCount = 0;
	        	var checkStatusWaitTime = 20000;
	        	setTimeout( async function checkSuccessStatus() {
	        		try {
	        			var provisioningState =  await checkProvisioningState(asyncUrl, accessToken);
	        			tl.debug("Status = " + provisioningState);
	        			if(provisioningState == "Succeeded") {
	        				return deferred.resolve("setNICStatusSuccess");
	        			}
	        		}
	        		catch(error) {
	        			// ignore errors and retry setting the network interface
	        			tl.debug(`Checking provisioning state errored out : ${error}`);
	        			retryCount++;
	        			tl.debug("Retrying setting network interface after " + sleepTime/1000 + " sec");
	        			return setTimeout(putNetworkInterface, sleepTime);
	        		}
	        		if(++checkStatusRetryCount == 10) {
	        			// Retry setting the network interface
	        			retryCount++;
	        			tl.debug("Retrying setting network interface after " + sleepTime/1000 + " sec");
	        			setTimeout(putNetworkInterface, sleepTime);
	        		}
					else {
						// Re-check the status of the provisioning state
						setTimeout(checkSuccessStatus, checkStatusWaitTime);
					}
	        	}, 1);
	        }
	        else if(response.statusCode == 429){
	        	body = JSON.parse(body);
	        	if(body["error"] && body["error"].code == "RetryableError") {
	        		retryCount++;
	        		tl.debug(JSON.stringify(body, null, 4));
        			tl.debug("Retrying setting network interface after " + sleepTime/1000 + " sec");
        			setTimeout(putNetworkInterface, sleepTime);
	        	}
	        }
	        else {
	        	deferred.reject(tl.loc("FailedSettingNetworkInterface", nic.name, response.statusCode, response.statusMessage, body));
	        }
		});
	}, 1);

	return deferred.promise;
}