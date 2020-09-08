import { AzureEndpoint, ApplicationInsights } from './azureModels';
export declare class AzureApplicationInsights {
    private _name;
    private _resourceGroupName;
    private _endpoint;
    private _client;
    constructor(endpoint: AzureEndpoint, resourceGroupName: string, name: string);
    get(): Promise<ApplicationInsights>;
    update(insightProperties: any): Promise<ApplicationInsights>;
    addReleaseAnnotation(annotation: any): Promise<void>;
    getResourceGroupName(): string;
}
export declare class ApplicationInsightsResources {
    private _endpoint;
    private _client;
    constructor(endpoint: AzureEndpoint);
    list(resourceGroupName?: string, filter?: string[]): Promise<ApplicationInsights[]>;
}
