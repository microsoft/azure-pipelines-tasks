import { AzureEndpoint } from './azureModels';
export declare class AzureSpringCloud {
    private _resourceGroup;
    private _serviceName;
    private _client;
    constructor(endpoint: AzureEndpoint, resourceGroup: string, serviceName: string);
    deployApplication(artifactToUpload: string, appName: string, deploymentName?: string): Promise<void>;
    protected getDeploymentUrl(appName: string, deploymentName?: string): Promise<string>;
    private _getFormattedName();
}
