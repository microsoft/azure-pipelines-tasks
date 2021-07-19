import { AzureEndpoint, WebTest } from './azureModels';
export declare class ApplicationInsightsWebTests {
    private _resourceGroupName;
    private _client;
    constructor(endpoint: AzureEndpoint, resourceGroup: string);
    list(): Promise<Array<WebTest>>;
    create(webTestData: WebTest): Promise<WebTest>;
}
