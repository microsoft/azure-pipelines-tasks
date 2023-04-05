import Model = require('./azureModels');
import { AzureEndpoint, IAzureMetricAlertRequestBody } from './azureModels';
export declare class AzureMonitorAlerts {
    private _resourceGroupName;
    private _endpoint;
    private _client;
    constructor(endpoint: AzureEndpoint, resourceGroupName: string);
    get(alertRuleName: string): Promise<any>;
    update(alertRuleName: string, resourceBody: IAzureMetricAlertRequestBody): Promise<Model.IAzureMetricAlertRequestBody>;
}
