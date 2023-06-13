import webClient = require('./webClient');
import { AzureEndpoint, AzureAppServiceConfigurationDetails } from './azureModels';
import { ServiceClient } from './AzureServiceClient';
export declare class ServiceClient_1 extends ServiceClient {
    beginRequest(request: webClient.WebRequest, reqOptions?: webClient.WebRequestOptions): Promise<webClient.WebResponse>
}
export declare class AzureAppService {
    private _resourceGroup;
    private _name;
    private _slot;
    private _appKind;
    private _isConsumptionApp;
    _client: ServiceClient;
    private _appServiceConfigurationDetails;
    private _appServicePublishingProfile;
    private _appServiceApplicationSetings;
    private _appServiceConfigurationSettings;
    private _appServiceConnectionString;
    constructor(endpoint: AzureEndpoint, resourceGroup: string, name: string, slot?: string, appKind?: string, isConsumptionApp?: boolean);
    start(): Promise<void>;
    stop(): Promise<void>;
    restart(): Promise<void>;
    delete(): Promise<void>;
    swap(slotName: string, preserveVNet?: boolean): Promise<void>;
    swapSlotWithPreview(slotName: string, preserveVNet?: boolean): Promise<void>;
    cancelSwapSlotWithPreview(): Promise<void>;
    get(force?: boolean): Promise<AzureAppServiceConfigurationDetails>;
    getPublishingProfileWithSecrets(force?: boolean): Promise<any>;
    getPublishingCredentials(): Promise<any>;
    getApplicationSettings(force?: boolean): Promise<AzureAppServiceConfigurationDetails>;
    updateApplicationSettings(applicationSettings: any): Promise<AzureAppServiceConfigurationDetails>;
    patchApplicationSettings(addProperties: any, deleteProperties?: any, formatJSON?: boolean): Promise<boolean>;
    patchApplicationSettingsSlot(addProperties: any): Promise<any>;
    getConfiguration(): Promise<AzureAppServiceConfigurationDetails>;
    updateConfiguration(applicationSettings: any): Promise<AzureAppServiceConfigurationDetails>;
    patchConfiguration(properties: any): Promise<any>;
    updateConfigurationSettings(properties: any, formatJSON?: boolean) : Promise<void>;
    getMetadata(): Promise<AzureAppServiceConfigurationDetails>;
    updateMetadata(applicationSettings: any): Promise<AzureAppServiceConfigurationDetails>;
    patchMetadata(properties: any): Promise<void>;
    patchConnectionString(addProperties: any): Promise<any>;
    patchConnectionStringSlot(addProperties: any): Promise<any>;
    getSlot(): string;
    getSiteVirtualNetworkConnections(): Promise<any>;
    getSitePrivateEndpointConnections(): Promise<any>;
    getConnectionStringValidation(connectionDetails): Promise<any>;
    getName(): string;
    syncFunctionTriggers(): Promise<any>;
    private _getPublishingProfileWithSecrets();
    private _getApplicationSettings();
    private _get();
    private _getFormattedName();
    private _getConnectionStrings(force?: boolean);
    private _updateConnectionStrings(connectionStringSettings: any);
}
