/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');

export class SonarQubeEndpoint {
    constructor(public Url: string, public Username: string, public Password: string) {
    }

    public static createSonarQubeEndpoint():SonarQubeEndpoint {
        var errorMessage = "Could not decode the generic endpoint. Please ensure you are running the latest agent (min version 0.3.2)";
        if (!tl.getEndpointUrl) {
            throw new Error(errorMessage);
        }

        var genericEndpoint: string = tl.getInput("sqConnectedServiceName");
        if (!genericEndpoint) {
            throw new Error(errorMessage);
        }

        var hostUrl = tl.getEndpointUrl(genericEndpoint, false);
        if (!hostUrl) {
            throw new Error(errorMessage);
        }

        // Currently the username and the password are required, but in the future they will not be mandatory
        // - so not validating the values here
        var hostUsername = SonarQubeEndpoint.getSonarQubeAuthParameter(genericEndpoint, 'username');
        var hostPassword = SonarQubeEndpoint.getSonarQubeAuthParameter(genericEndpoint, 'password');

        return new SonarQubeEndpoint(hostUrl, hostUsername, hostPassword);

    }

    // Gets a SonarQube authentication parameter from the specified connection endpoint.
    // The endpoint stores the auth details as JSON. Unfortunately the structure of the JSON has changed through time, namely the keys were sometimes upper-case.
    // To work around this, we can perform case insensitive checks in the property dictionary of the object. Note that the PowerShell implementation does not suffer from this problem.
    // See https://github.com/Microsoft/vso-agent/blob/bbabbcab3f96ef0cfdbae5ef8237f9832bef5e9a/src/agent/plugins/release/artifact/jenkinsArtifact.ts for a similar implementation
    private static getSonarQubeAuthParameter(endpoint: string, paramName: string):string {
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
}