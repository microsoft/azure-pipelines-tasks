import * as tl from 'vsts-task-lib/task';
import * as Q from 'q';
import * as os from 'os';
import * as path from 'path'
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import { ServiceClient } from 'azure-arm-rest/AzureServiceClient';
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
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var experimentId = tl.getInput('ExperimentId', true);
        var action = tl.getInput('Action', true);
        var flightsTraffic = tl.getInput('FlightsTraffic');

        const endpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();
        var client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID);
        var token = await _getSPNAuthorizationTokenFromKey(endpoint);
        tl.debug(`token = ${token}`);

        if (action == "ChangeTraffic") {
            if (!flightsTraffic) {
                tl.setResult(tl.TaskResult.Failed, "flight traffic needs to be set");
                throw "Null/empty string exception: flight traffic needs to be set"
            }

            var webRequest = new webClient.WebRequest();
            webRequest.uri = "https://exp.microsoft.com/api/experiments/" + experimentId;
            webRequest.method = 'PATCH';
            webRequest.headers = {};
            webRequest.headers["Authorization"] = "Bearer " + token;
            webRequest.headers['Content-Type'] = 'application/json';
            webRequest.body = JSON.stringify({
                "Flights": _getFlightsTrafficData(flightsTraffic)
            });

            var response = await webClient.sendRequest(webRequest);
            tl.debug(response.statusMessage);
            tl.debug(util.inspect(response.body, {showHidden: false, depth: null}));
        }

        else if (action == "Start") {
            var webRequest = new webClient.WebRequest();
            webRequest.uri = "https://exp.microsoft.com/api/experiments/" + experimentId + "/start";
            webRequest.method = 'POST';
            webRequest.headers = {};
            webRequest.headers["Authorization"] = "Bearer " + token;
            webRequest.headers['Content-Type'] = 'application/json';

            var response = await webClient.sendRequest(webRequest);
            tl.debug(response.statusMessage);
        }

        else if (action == "Stop") {
            var webRequest = new webClient.WebRequest();
            webRequest.uri = "https://exp.microsoft.com/api/experiments/" + experimentId + "/stop";
            webRequest.method = 'POST';
            webRequest.headers = {};
            webRequest.headers["Authorization"] = "Bearer " + token;
            webRequest.headers['Content-Type'] = 'application/json';

            var response = await webClient.sendRequest(webRequest);
            tl.debug(response.statusMessage);
        }
	}
	catch(error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

function _getSPNAuthorizationTokenFromKey(endpoint: AzureEndpoint) {
    var deferred = Q.defer();
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
    webClient.sendRequest(webRequest).then((response) => {
        if (response.statusCode == 200) {
            deferred.resolve(response.body.access_token);
        }
        else {
            deferred.reject(tl.loc('CouldNotFetchAccessTokenforAzureStatusCode', response.statusCode, response.statusMessage));
        }
    }, (error) => {
        deferred.reject(error);
    });
    return deferred.promise;
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