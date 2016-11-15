import * as tl from 'vsts-task-lib/task';
import * as Q from 'q';
import * as httpClient from 'vso-node-api/HttpClient';
import * as restClient from 'vso-node-api/RestClient';
import * as queryString from 'querystring';

var httpObj = new httpClient.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var restObj = new restClient.RestClient(httpObj);

var authUrl = 'https://login.windows.net/';
var azureApiVersion = '2016-09-01';

export function getAccessToken(SPN, endpointUrl: string): Q.Promise<string> {

	var deferred = Q.defer<string>();
    var authorityUrl = authUrl + SPN.tenantID + "/oauth2/token/";

    var post_data = queryString.stringify({
    	resource: endpointUrl, 
		client_id: SPN.servicePrincipalClientID,
		grant_type: "client_credentials", 
		client_secret: SPN.servicePrincipalKey
    });

    tl.debug(tl.loc('RequestingForAuthToken', authorityUrl));
    httpObj.send("POST", authorityUrl, post_data, {}, (error, response, body) => {
		if(error) {
			deferred.reject(error);
		}
		else if (response.statusCode == 200) {
			deferred.resolve(JSON.parse(body).access_token);
		}
		else {
			deferred.reject("Could not fetch access token. Request ended with status code : " + response.statusCode);
		};
	}); 

    return deferred.promise;
}

export async function getNetworkInterfaces(SPN, endpointUrl: string, resourceGroupName: string) {

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
			tl.error(response.statusMessage);
			deferred.reject(error);
		}

	});
	return deferred.promise;
}

export async function getLoadBalancer(SPN, endpointUrl: string, resourceGroupName: string, name: string) {
	
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
            tl.error(response.statusMessage);
            deferred.reject(error);
        }
    });
	
    return deferred.promise;
}

export async function setNetworkInterface(SPN, endpointUrl: string, nic, resourceGroupName: string){

	var deferred = Q.defer();   
	var restUrl = "https://management.azure.com/subscriptions/" + SPN.subscriptionId + "/resourceGroups/" + resourceGroupName + "/providers/Microsoft.Network/networkInterfaces/" + nic.name + "?api-version=" + azureApiVersion;
	var accessToken = await getAccessToken(SPN, endpointUrl);
	var requestHeader = {
		"Authorization": 'Bearer ' + accessToken
	};

	tl._writeLine("Setting the network interface");
	var maxRetries = 10;	
	var sleepTime = (Math.floor(Math.random() * 6) + 5) * 1000;	// sleep time in ms
	var retryCount = 1;
	var interval = setInterval(() => {
		if(retryCount > maxRetries) {
			clearInterval(interval);
			tl.error("Max no of retries exceeded");
			deferred.reject("Max no of retries exceeded");
		}
		tl.debug(`Trial Count = ${retryCount}`);
		restObj.replace(restUrl, azureApiVersion, nic, requestHeader, null, (error, response, body) => {
	        if(error) {
	        	if(response == 429) {
	        		//Handle Too Many Requests Error
	        		tl.debug("Retrying after " + sleepTime/1000 + " sec");
	        		retryCount++;
	        		return;
	        	}
	            else {
	            	deferred.reject(error);
	            }
	        }
	        else if(response == 200) {
	        	clearInterval(interval);
	            deferred.resolve("Network Interface Set Successfully");
	        }
	        else {
	        	clearInterval(interval);
	        	tl.error("Response : " + response);
	        	deferred.reject(response);
	        }
		});
	}, sleepTime);

	return deferred.promise;
}