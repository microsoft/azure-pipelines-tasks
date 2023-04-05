import { AzureEndpoint } from "./azureModels";
export declare class AzureRMEndpoint {
    endpoint: AzureEndpoint;
    private _connectedServiceName;
    private applicationTokenCredentials;
    private _environments;
    constructor(connectedServiceName: string);
    getEndpoint(useGraphActiveDirectoryResource?: boolean): Promise<AzureEndpoint>;
    private _updateAzureStackData(endpoint);
}
export declare function dispose(): void;
