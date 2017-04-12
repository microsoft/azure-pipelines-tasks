"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "./containerconnection";
import AuthenticationTokenProvider  from "./registryauthenticationprovider/authenticationtokenprovider"
import ACRAuthenticationTokenProvider from "./registryauthenticationprovider/acrauthenticationtokenprovider"
import GenericAuthenticationTokenProvider from "./registryauthenticationprovider/genericauthenticationtokenprovider"
import Q = require('q');

// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

// get the registry server authentication provider 
var registryType = tl.getInput("containerregistrytype", true);
var authenticationProvider : AuthenticationTokenProvider;

if(registryType ==  "Azure Container Registry"){
    authenticationProvider = new ACRAuthenticationTokenProvider(tl.getInput("azureSubscriptionEndpoint"), tl.getInput("azureContainerRegistry"));
} 
else {
    authenticationProvider = new GenericAuthenticationTokenProvider(tl.getInput("dockerRegistryEndpoint"));
}

authenticationProvider.getAuthenticationToken().then(
    function success(registryAuthenticationToken) {

        // Connect to any specified container host and/or registry 
        var connection = new ContainerConnection();
        connection.open(tl.getInput("dockerHostEndpoint"), registryAuthenticationToken);

        try{
            // Run the specified action
            var action = tl.getInput("action", true);
            /* tslint:disable:no-var-requires */
            require({
                "Build an image": "./containerbuild",
                "Push an image": "./containerpush",
                "Run an image": "./containerrun",
                "Run a Docker command": "./containercommand"
            }[action]).run(connection)
            .then((result) => {
                // Write the output of the command to the configured output variable
                const outputVariable = tl.getInput("outputVariableName", false);
                if (outputVariable !== null) {
                    tl.setVariable(outputVariable, result);
                    tl.debug(`Set ${outputVariable} to: ${result}`);
                }
            }).fin(function cleanup() {
            connection.close();
            }).done();
        }
        catch(Error) {
            connection.close();
            throw Error;
        }
    },
    function failure(err) {
         tl.setResult(tl.TaskResult.Failed, err.message);
    }
    ).then(function success() {
            tl.setResult(tl.TaskResult.Succeeded, "");
        }, function failure(err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        }).catch( (reason) => {
         tl.setResult(tl.TaskResult.Failed, reason);
    });
