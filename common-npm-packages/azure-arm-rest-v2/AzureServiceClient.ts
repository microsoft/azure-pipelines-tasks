import tl = require('azure-pipelines-task-lib/task');
import msRestAzure = require("./azure-arm-common");
import { AzureServiceClientBase, AzureError } from './AzureServiceClientBase';
import path = require('path');

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export class ServiceClient extends AzureServiceClientBase{
    public subscriptionId: string;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, timeout?: number) {
        super(credentials, timeout);
        this.validateInputs(subscriptionId);
        this.subscriptionId = subscriptionId;
    }

    public getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string {
        parameters['{subscriptionId}'] = encodeURIComponent(this.subscriptionId);
        return super.getRequestUriForBaseUri(this.baseUri, uriFormat, parameters, queryParameters, apiVersion);
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

    protected validateInputs(subscriptionId: string) {
        if (!subscriptionId) {
            throw new Error(tl.loc("SubscriptionIdCannotBeNull"));
        }
    }
}
