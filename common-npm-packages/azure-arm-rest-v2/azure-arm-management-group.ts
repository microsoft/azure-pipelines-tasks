import tl = require('azure-pipelines-task-lib/task');
import msRestAzure = require('./azure-arm-common');
import azureServiceClientBase = require('./AzureServiceClientBase');
import depolymentsBase = require('./DeploymentsBase');
import path = require('path');

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export class ManagementGroupManagementClient extends azureServiceClientBase.AzureServiceClientBase {

    public managementGroupId: string;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, managementGroupId: string, options?: any) {
        super(credentials);
        this.validateInputs(managementGroupId);
        this.apiVersion = '2021-04-01';
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;
        if (!!options && !!options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        this.deployments = new ManagementGroupDeployments(this);
        this.managementGroupId = managementGroupId;
    }

    public getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string {
        parameters['{managementGroupId}'] = encodeURIComponent(this.managementGroupId);
        return super.getRequestUriForBaseUri(this.baseUri, uriFormat, parameters, queryParameters, apiVersion);
    }

    private validateInputs(managementGroupId: string) {
        if (!managementGroupId) {
            throw new Error(tl.loc("ManagementGroupIdCannotBeNull"));
        }
    }
}

export class ManagementGroupDeployments extends depolymentsBase.DeploymentsBase {

    protected client: ManagementGroupManagementClient;

    constructor(client: ManagementGroupManagementClient) {
        super(client);
        this.client = client;
    }

    public createOrUpdate(deploymentName, deploymentParameters, callback) {

        // Create HTTP request uri
        var requestUri = this.client.getRequestUri(
            '//providers/Microsoft.Management/managementGroups/{managementGroupId}/providers/Microsoft.Resources/deployments/{deploymentName}',
            {
                '{deploymentName}': deploymentName
            }
        );
        super.deployTemplate(requestUri, deploymentName, deploymentParameters, callback);
    }

    public validate(deploymentName, deploymentParameters, callback) {

        // Create HTTP request uri
        var requestUri = this.client.getRequestUri(
            '//providers/Microsoft.Management/managementGroups/{managementGroupId}/providers/Microsoft.Resources/deployments/{deploymentName}/validate',
            {
                '{deploymentName}': deploymentName
            }
        );
        super.validateTemplate(requestUri, deploymentName, deploymentParameters, callback);
    }
}