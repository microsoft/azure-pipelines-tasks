"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";

/*
Signs into ACR helm registry using service principal
*/

export function addArguments(helmCli: helmcli): void {
    helmCli.addArgument("login");

    let isTokenAuth: boolean = false;
    const token = tl.getVariable("ACR_ACCESS_TOKEN");
    
    if (token && token.length > 0) {
        isTokenAuth = true;
    }

    let user: string, password: string;

    if (isTokenAuth) {
        user = "00000000-0000-0000-0000-000000000000";
        password = token;
    }
    else {
        const acrEndpoint = tl.getInput("azureSubscriptionEndpointForACR");
        user = tl.getEndpointAuthorizationParameter(acrEndpoint, 'serviceprincipalid', true);
        password = tl.getEndpointAuthorizationParameter(acrEndpoint, 'serviceprincipalkey', true);
    }
 
    const acr = tl.getInput("azureContainerRegistry");
    helmCli.addArgument(acr);
    helmCli.addArgument("--username");
    helmCli.addArgument(user);
    helmCli.addArgument("--password")
    helmCli.addArgument(password);
}