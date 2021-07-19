import msRestAzure = require("./azure-arm-common");
import { AzureServiceClientBase } from './AzureServiceClientBase';
export declare class ServiceClient extends AzureServiceClientBase {
    subscriptionId: string;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, timeout?: number);
    getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string;
    isValidResourceGroupName(resourceGroupName: string): void;
    protected validateInputs(subscriptionId: string): void;
}
