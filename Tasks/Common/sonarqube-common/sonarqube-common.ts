/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import {ToolRunner} from 'vsts-task-lib/toolrunner';

// Creates the tool runner for executing SonarQube.
export function applySonarQubeParams(toolRunner:ToolRunner, sqHostUrl, sqHostUsername, sqHostPassword, sqDbUrl?, sqDbUsername?, sqDbPassword?):ToolRunner {

    toolRunner.arg('-Dsonar.host.url=' + sqHostUrl);
    toolRunner.arg('-Dsonar.login=' + sqHostUsername);
    toolRunner.arg('-Dsonar.password=' + sqHostPassword);
    if (sqDbUrl) {
        toolRunner.arg('-Dsonar.jdbc.url=' + sqDbUrl);
    }
    if (sqDbUsername) {
        toolRunner.arg('-Dsonar.jdbc.username=' + sqDbUsername);
    }
    if (sqDbPassword) {
        toolRunner.arg('-Dsonar.jdbc.password=' + sqDbPassword);
    }

    return toolRunner;
}

export class SonarQubeEndpoint {
    constructor(public Url, public Username, public Password) {
    }
}

// Gets SonarQube connection endpoint details.
export function getSonarQubeEndpointFromInput(inputFieldName):SonarQubeEndpoint {
    var errorMessage = "Could not decode the generic endpoint. Please ensure you are running the latest agent (min version 0.3.2)";
    if (!tl.getEndpointUrl) {
        throw new Error(errorMessage);
    }

    var genericEndpoint = tl.getInput(inputFieldName);
    if (!genericEndpoint) {
        throw new Error(errorMessage);
    }

    var hostUrl = tl.getEndpointUrl(genericEndpoint, false);
    if (!hostUrl) {
        throw new Error(errorMessage);
    }

    // Currently the username and the password are required, but in the future they will not be mandatory
    // - so not validating the values here
    var hostUsername = getSonarQubeAuthParameter(genericEndpoint, 'username');
    var hostPassword = getSonarQubeAuthParameter(genericEndpoint, 'password');

    return new SonarQubeEndpoint(hostUrl, hostUsername, hostPassword);
}

// Gets a SonarQube authentication parameter from the specified connection endpoint.
// The endpoint stores the auth details as JSON. Unfortunately the structure of the JSON has changed through time, namely the keys were sometimes upper-case.
// To work around this, we can perform case insensitive checks in the property dictionary of the object. Note that the PowerShell implementation does not suffer from this problem.
// See https://github.com/Microsoft/vso-agent/blob/bbabbcab3f96ef0cfdbae5ef8237f9832bef5e9a/src/agent/plugins/release/artifact/jenkinsArtifact.ts for a similar implementation
function getSonarQubeAuthParameter(endpoint, paramName) {

    var paramValue = null;
    var auth = tl.getEndpointAuthorization(endpoint, false);

    if (auth.scheme != "UsernamePassword") {
        throw new Error("The authorization scheme " + auth.scheme + " is not supported for a SonarQube endpoint. Please use a username and a password.");
    }

    var parameters = Object.getOwnPropertyNames(auth['parameters']);

    var keyName;
    parameters.some(function (key) {

        if (key.toLowerCase() === paramName.toLowerCase()) {
            keyName = key;

            return true;
        }
    });

    if (keyName) {
        paramValue = auth['parameters'][keyName];
    }

    return paramValue;
}
