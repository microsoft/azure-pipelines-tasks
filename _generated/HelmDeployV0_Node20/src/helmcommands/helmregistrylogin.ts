"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";

/*
Signs into ACR helm registry using service principal
*/

export function addArguments(helmCli: helmcli): void {
    helmCli.addArgument("login");
    const acrEndpoint = tl.getInput("azureSubscriptionEndpointForACR");
    const user = tl.getEndpointAuthorizationParameter(acrEndpoint, 'serviceprincipalid', true);
    const password = tl.getEndpointAuthorizationParameter(acrEndpoint, 'serviceprincipalkey', true);
    const acr = tl.getInput("azureContainerRegistry");
    helmCli.addArgument(acr);
    helmCli.addArgument("--username");
    helmCli.addArgument(user);
    helmCli.addArgument("--password")
    helmCli.addArgument(password);
}