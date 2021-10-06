import tl = require('azure-pipelines-task-lib/task');
import msRestAzure = require('./azure-arm-common');
import azureServiceClientBase = require('./AzureServiceClientBase');
import depolymentsBase = require('./DeploymentsBase');
import path = require('path');

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export class SubscriptionManagementClient extends azureServiceClientBase.AzureServiceClientBase {

    public subscriptionId: string;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, options?: any) {
        super(credentials);
        this.validateInputs(subscriptionId);
        this.apiVersion = '2021-04-01';
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;
        if (!!options && !!options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        this.deployments = new SubscriptionDeployments(this);
        this.subscriptionId = subscriptionId;
    }

    public getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string {
        parameters['{subscriptionId}'] = encodeURIComponent(this.subscriptionId);
        return super.getRequestUriForBaseUri(this.baseUri, uriFormat, parameters, queryParameters, apiVersion);
    }

    private validateInputs(subscriptionId: string) {
        if (!subscriptionId) {
            throw new Error(tl.loc("SubscriptionIdCannotBeNull"));
        }
    }
}

export class SubscriptionDeployments extends depolymentsBase.DeploymentsBase {

    protected client: SubscriptionManagementClient;

    constructor(client: SubscriptionManagementClient) {
        super(client);
        this.client = client;
    }

    public createOrUpdate(deploymentParameters, parameters, callback) {

        // Create HTTP request uri
        var uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/providers/Microsoft.Resources/deployments/{deploymentName}',
            {
                '{deploymentName}': deploymentParameters
            }
        );
        super.deployTemplate(uri, deploymentParameters, parameters, callback);
    }

    public validate(deploymentParameters, parameters, callback) {

        // Create HTTP request uri
        var uri = this.client.getRequestUri(
            '//subscriptions/{subscriptionId}/providers/Microsoft.Resources/deployments/{deploymentName}/validate',
            {
                '{deploymentName}': deploymentParameters
            }
        );
        super.validateTemplate(uri, deploymentParameters, parameters, callback);
    }
}