"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";
import ACRAuthenticationTokenProvider from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/acrauthenticationtokenprovider";

/*
Signs into ACR helm registry using service principal
*/

export async function addArguments(helmCli: helmcli): Promise<void> {
    const acrEndpoint = tl.getInput("azureSubscriptionEndpointForACR");
    const acr = tl.getInput("azureContainerRegistry");
    const authScheme = tl.getEndpointAuthorizationScheme(acrEndpoint, false).toLowerCase()
    
    let user: string, password: string;

    if (authScheme === "workloadidentityfederation") {
        const tokenProvider = new ACRAuthenticationTokenProvider(acrEndpoint, tl.getInput("azureContainerRegistry"));
        const token = await tokenProvider.getToken();

        user = token.getUsername();
        password = token.getPassword();

        // Set the token as a secret to prevent it from being printed in the logs
        tl.setSecret(password);
    }
    else {    
        user = tl.getEndpointAuthorizationParameter(acrEndpoint, 'serviceprincipalid', true);
        password = tl.getEndpointAuthorizationParameter(acrEndpoint, 'serviceprincipalkey', true);
    }
 
    helmCli.addArgument("login");
    helmCli.addArgument(acr);
    helmCli.addArgument("--username");
    helmCli.addArgument(user);
    helmCli.addArgument("--password")
    helmCli.addArgument(password);
}