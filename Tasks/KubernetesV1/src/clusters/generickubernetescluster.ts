"use strict";

import tl = require('vsts-task-lib/task');
var Base64 = require('js-base64').Base64;

export async function getKubeConfig(): Promise<string> {
    var kubernetesServiceEndpoint = tl.getInput("kubernetesServiceEndpoint", true);
    var authorizationType = tl.getEndpointDataParameter(kubernetesServiceEndpoint, 'authorizationType', false);
    if (authorizationType === "Kubeconfig")
    {
        return tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'kubeconfig', false);

    }
    else if (authorizationType === "ServiceAccount")
    {
        return createKubeconfig(kubernetesServiceEndpoint);
    } 
}

function createKubeconfig(kubernetesServiceEndpoint: string): string
{
    var kubeconfigTemplateString = '{"apiVersion":"v1","kind":"Config","clusters":[{"cluster":{"certificate-authority-data": null,"server": null}}], "users":[{"user":{"token": null}}]}';
    var kubeconfigTemplate = JSON.parse(kubeconfigTemplateString);

    //populate server url, ca cert and token fields
    kubeconfigTemplate.clusters[0].cluster.server = tl.getEndpointUrl(kubernetesServiceEndpoint, false);
    kubeconfigTemplate.clusters[0].cluster["certificate-authority-data"] = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'serviceAccountCertificate', false);
    kubeconfigTemplate.users[0].user.token = Base64.decode(tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'serviceAccountToken', false));

    return JSON.stringify(kubeconfigTemplate);
}
