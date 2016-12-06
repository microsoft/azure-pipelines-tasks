import * as tl from 'vsts-task-lib/task';
import * as Q from 'q';
import * as querystring from "querystring";
import * as httpClient from 'vso-node-api/HttpClient';
import * as restClient from 'vso-node-api/RestClient';

var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var restObj = new restClient.RestCallbackClient(httpObj);

var authUrl = 'https://login.windows.net/';
var azureApiVersion = '2016-09-01';

export function getAccessToken(SPN, endpointUrl: string): Q.Promise<string> {

	var deferred = Q.defer<string>();
	var authorityUrl = authUrl + SPN.tenantID + "/oauth2/token/";

	var post_data = querystring.stringify({
		resource: endpointUrl, 
		client_id: SPN.servicePrincipalClientID,
		grant_type: "client_credentials", 
		client_secret: SPN.servicePrincipalKey
	});

	var requestHeader = {
		"Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
	};

	tl.debug(tl.loc('RequestingForAuthToken', authorityUrl));
	httpObj.send("POST", authorityUrl, post_data, requestHeader, (error, response, body) => {
		if(error) {
			deferred.reject(error);
		}
		else if (response.statusCode == 200) {
			deferred.resolve(JSON.parse(body).access_token);
		}
		else {
			deferred.reject(tl.loc("CouldNotFetchAcessToken", response.statusCode, response.statusMessage, body));
		};
	}); 

    return deferred.promise;
}

export async function getNetworkInterfacesInRG(SPN, endpointUrl: string, resourceGroupName: string) {

	var deferred = Q.defer<any>();
	var restUrl = "https://management.azure.com/subscriptions/" + SPN.subscriptionId + "/resourceGroups/" + resourceGroupName + "/providers/Microsoft.Network/networkInterfaces?api-version=" + azureApiVersion;
	var accessToken = await getAccessToken(SPN, endpointUrl);

	var requestHeader = {
		Authorization: 'Bearer ' + accessToken
	};

	tl.debug(tl.loc('GettingAllNetworkInterfacesInTheResourceGroup', resourceGroupName));
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

export async function getLoadBalancer(SPN, endpointUrl: string, name: string, resourceGroupName: string) {
	
	var deferred = Q.defer<any>();    
	var restUrl = "https://management.azure.com/subscriptions/" + SPN.subscriptionId + "/resourceGroups/" + resourceGroupName + "/providers/Microsoft.Network/loadBalancers/" + name + "?api-version=" + azureApiVersion;
	var accessToken = await getAccessToken(SPN, endpointUrl);

	var requestHeader = {
		authorization: 'Bearer ' + accessToken
	}

	tl.debug('Getting the load balancer: ' + name);
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

export async function getNetworkInterface(SPN, endpointUrl, name: string, resourceGroupName: string) {
	var deferred = Q.defer<any>();   
	var restUrl = "https://management.azure.com/subscriptions/" + SPN.subscriptionId + "/resourceGroups/" + resourceGroupName + "/providers/Microsoft.Network/networkInterfaces/" + name + "?api-version=" + azureApiVersion;
	var accessToken = await getAccessToken(SPN, endpointUrl);

	var requestHeader = {
		authorization: 'Bearer ' + accessToken
	}

	tl.debug('Getting the Network Interface: ' + name);
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

async function checkProvisioningState(SPN, endpointUrl, nicName: string, resourceGroupName: string) {
	var nic = await getNetworkInterface(SPN, endpointUrl, nicName, resourceGroupName);
	return nic.properties.ipConfigurations[0].properties.provisioningState;
}

export async function setNetworkInterface(SPN, endpointUrl: string, nic, resourceGroupName: string){

	var deferred = Q.defer();   
	var restUrl = "https://management.azure.com/subscriptions/" + SPN.subscriptionId + "/resourceGroups/" + resourceGroupName + "/providers/Microsoft.Network/networkInterfaces/" + nic.name + "?api-version=" + azureApiVersion;
	var accessToken = await getAccessToken(SPN, endpointUrl);
	var requestHeader = {
		"Authorization": 'Bearer ' + accessToken
	};

	tl._writeLine(tl.loc("SettingTheNetworkInterface", nic.name));
	var maxRetries = 10;	
	var sleepTime = (Math.floor(Math.random() * 6) + 5) * 1000;	// sleep time in ms
	var retryCount = 1;

	setTimeout (function putNetworkInterface() {
		if(retryCount > maxRetries) {
			deferred.reject(tl.loc("MaxRetriesExceededForSettingNetworkInterface", nic.name));
			return;
		}
		
		tl.debug(`Trial Count = ${retryCount}`);
		restObj.replace(restUrl, azureApiVersion, nic, requestHeader, null, (error, response, body) => {
	        if(error) {
	        	if(response == 429) {
	        		//Handle Too Many Requests Error
	        		retryCount++;
	        		tl.debug("Retrying after " + sleepTime/1000 + " sec");
	        		setTimeout(putNetworkInterface, sleepTime);
	        	}
	            else {
	            	deferred.reject(error);
	            }
	        }
	        else if(response == 200) {	

	        	// wait for the provisioning state to be succeeded
	        	// check after every 20 seconds
	        	var checkStatusRetryCount = 0;
	        	var checkStatusWaitTime = 20000;
	        	setTimeout(async function checkSuccessStatus() {
	        		var provisioningState = await checkProvisioningState(SPN, endpointUrl, nic.name, resourceGroupName);
	        		tl.debug("Provisioning State = " + provisioningState);
	        		if(provisioningState == "Succeeded"){
	            		deferred.resolve("setNICStatus");
	        		}
	        		else {
	        			if(++checkStatusRetryCount == 10){
	        				// Retry the SetNetworkInterface for at max 10 times
	        				retryCount++;
	        				tl.debug("Retrying after " + sleepTime/1000 + " sec");
	        				setTimeout(putNetworkInterface, sleepTime);
	        			}
						else {
							// Re-check the status of the provisioning state
							setTimeout(checkSuccessStatus, checkStatusWaitTime);
						}
	        		}
	        	}, checkStatusWaitTime);	
	        }
	        else {
	        	tl.error(tl.loc("FailedSettingNetworkInterface", nic.name, response));
	        	deferred.reject(response);
	        }
		});
	}, 1);

	return deferred.promise;
}