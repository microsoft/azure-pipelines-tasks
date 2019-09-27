import * as tl from 'vsts-task-lib/task';
import * as Q from 'q';
import * as os from 'os';
import * as path from 'path'
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import { ServiceClient, ToError } from 'azure-arm-rest/AzureServiceClient';
import webClient = require('azure-arm-rest/webClient');
import querystring = require("querystring");
const util = require('util');

interface FlightTraffic {
    Name: string;
    TrafficExposureSequence: {};
}

async function run() {
	try {
		tl.setResourcePath(path.join( __dirname, 'task.json'));
        const connectedServiceName = tl.getInput('ConnectedServiceName', true);
        const action = tl.getInput('Action', true);
		const featureId = tl.getInput('FeatureId');
		const featureJson = tl.getInput('FeatureBody');
		const progressionJson = tl.getInput('ProgressionBody');

        const endpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();
        //var client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID);
        const token = await _getSPNAuthorizationTokenFromKey(endpoint);
        tl.debug(`token = ${token}`);

        var webRequest = new webClient.WebRequest();
        webRequest.uri = "https://exp.microsoft.com/api/features";
        webRequest.headers = {};
        webRequest.headers["Authorization"] = "Bearer " + token;
        webRequest.headers["Content-Type"] = "application/json";

        switch (action) {
            case "CreateFeature": {
                webRequest.method = 'POST';
                webRequest.body = featureJson;
				break;
            }
			
			case "CreateProgression": {
			    webRequest.uri = "https://exp.microsoft.com/api/features/" + featureId + "/progressions";
                webRequest.method = 'POST';
                webRequest.body = progressionJson;
				break;
            }
        }

        const response = await webClient.sendRequest(webRequest);

        tl.debug("response: " + JSON.stringify(response));
				
        if (!response.statusCode.toString().startsWith("2")) {
            throw ToError(response);
        }
		
		const objectId = response.body;
		tl.debug("objectId: " + objectId);
		
		if (action == "CreateFeature")
		{
		    tl.setVariable('FeatureId', objectId);
		}
		else{
			webRequest.uri = webRequest.uri + "/" + objectId;
            webRequest.method = 'GET';
			const getResponse = await webClient.sendRequest(webRequest);
			tl.debug("getResponse: " + JSON.stringify(getResponse));
			if (!getResponse.statusCode.toString().startsWith("2")) {
				throw ToError(getResponse);
			}
			
			let experiemnts = getResponse.body.Studies;
			const numberOfExperiemnts = experiemnts.length;
			for (let i = 0; i < numberOfExperiemnts; i++) {
			    let varName = 'Experiment' + (i + 1) + 'Id';
				tl.setVariable(varName, experiemnts[i].Id);
			}			
		}
	}
	catch(error) {
		tl.setResult(tl.TaskResult.Failed, JSON.stringify(error));
	}
}

async function _getSPNAuthorizationTokenFromKey(endpoint: AzureEndpoint): Promise<webClient.WebResponse> {

    let webRequest = new webClient.WebRequest();
    webRequest.method = "POST";
    webRequest.uri = endpoint.environmentAuthorityUrl + endpoint.tenantID + "/oauth2/token/";
    webRequest.body = querystring.stringify({
        resource: "https://exp.microsoft.com",
        client_id: endpoint.servicePrincipalClientID,
        grant_type: "client_credentials",
        client_secret: endpoint.servicePrincipalKey
    });
    webRequest.headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
    };

    let response: webClient.WebResponse;

    try {
        response = await webClient.sendRequest(webRequest);
        if (response.statusCode.toString().startsWith("2")) {
            return response.body.access_token;
        }
        else {
            tl.debug("Error handler 1");
            throw tl.loc('CouldNotFetchAccessTokenforAzureStatusCode', response.statusCode, response.statusMessage);
        }
    }
    catch (error) {
        tl.debug("Error handler 2");
        throw tl.loc('CouldNotFetchAccessTokenforAzureStatusCode', response.statusCode, response.statusMessage);
    }
}

function _getFlightsTrafficData(flightsTraffic: string): FlightTraffic[] {
    var flightsTrafficRawData: string[] = flightsTraffic.split(';'); //make more robust. example if there is ';' in the end
    var flightsTrafficData: FlightTraffic[] = [];
    flightsTrafficRawData.forEach((trafficData: string) => {
        flightsTrafficData.push({ Name: trafficData.split(':')[0].trim(), TrafficExposureSequence: { "AB": trafficData.split(':')[1].trim() } } as FlightTraffic);
    });

    tl.debug(`flights traffic data = ${JSON.stringify(flightsTrafficData)}`)
    return flightsTrafficData;
}

run();