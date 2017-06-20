import tl = require("vsts-task-lib/task");
import msRestAzure = require("./operations/azure-rest/azure-arm-common");
import path = require("path");
import * as os from 'os';
import util = require("util");
import armStorage = require("./operations/azure-rest/azure-arm-storage");
import blobUtils = require("./operations/AzureBlobUtils");

function run(): Q.Promise<void> {
    var artifactsDirectory = tl.getVariable('System.ArtifactsDirectory');
    var workingDirectory = tl.getVariable('System.DefaultWorkingDirectory');
    var azCopyExeLocation: string = path.join(workingDirectory, 'AzCopy', 'AzCopy.exe');

    var connectedServiceName = tl.getInput('ConnectedServiceName', true);
    var storageAccountName = tl.getInput('StorageAccountName', true);
    var containerName = tl.getInput('ContainerName', true);
    var commonVirtualPath = ""; // tl.getInput('CommonVirtualPath', true);
    var subscriptionId = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);
    var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedServiceName, "serviceprincipalid", false);

    var credentials = getARMCredentials(connectedServiceName);
    var armStorageClient: armStorage.StorageManagementClient = new armStorage.StorageManagementClient(credentials, subscriptionId);
    var blobUtilsClient: blobUtils.AzureBlobUtils = new blobUtils.AzureBlobUtils(armStorageClient, azCopyExeLocation);

    return blobUtilsClient.downloadFromBlob(storageAccountName, containerName, commonVirtualPath, artifactsDirectory);
}

function getARMCredentials(connectedService: string): msRestAzure.ApplicationTokenCredentials {
    var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
    var servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
    var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);
    var armUrl: string = tl.getEndpointUrl(connectedService, true);
    var envAuthorityUrl: string = tl.getEndpointDataParameter(connectedService, 'environmentAuthorityUrl', true);
    envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.windows.net/";
    var credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey, armUrl, envAuthorityUrl);
    return credentials;
}

run().then((result) =>
   tl.setResult(tl.TaskResult.Succeeded, "")
).catch((error) =>
    tl.setResult(tl.TaskResult.Failed, error)
);