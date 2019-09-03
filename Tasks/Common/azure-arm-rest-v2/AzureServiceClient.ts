import tl = require('azure-pipelines-task-lib/task');
import msRestAzure = require("./azure-arm-common");
import { AzureServiceClientBase, AzureError } from './AzureServiceClientBase';

export class ServiceClient extends AzureServiceClientBase{
    protected apiVersion: string;
    protected baseUri: string;
    protected acceptLanguage: string;
    protected longRunningOperationRetryTimeout: number;
    protected generateClientRequestId: boolean;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, timeout?: number) {
        super(credentials, timeout);
        this.validateInputs(credentials, subscriptionId);
        this.subscriptionId = subscriptionId;
        this.baseUri = credentials.baseUrl;
        this.longRunningOperationRetryTimeout = !!timeout ? timeout : 0; // In minutes
    }

    protected validateInputs(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string) {
        this.validateCredentials(credentials);
        if (!subscriptionId) {
            throw new Error(tl.loc("SubscriptionIdCannotBeNull"));
        }
    }
    
    public isValidResourceGroupName(resourceGroupName: string) {
        if (!resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
            throw new Error(tl.loc("ResourceGroupCannotBeNull"));
        }
        if (resourceGroupName !== null && resourceGroupName !== undefined) {
            if (resourceGroupName.length > 90) {
                throw new Error(tl.loc("ResourceGroupExceededLength"));
            }
            if (resourceGroupName.length < 1) {
                throw new Error(tl.loc("ResourceGroupDeceededLength"));
            }
            if (resourceGroupName.match(/^[-\w\._\(\)]+$/) === null) {
                throw new Error(tl.loc("ResourceGroupDoesntMatchPattern"));
            }
        }
    }
}
