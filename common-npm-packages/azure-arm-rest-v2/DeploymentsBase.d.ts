import azureServiceClientBase = require('./AzureServiceClientBase');
export declare abstract class DeploymentsBase {
    protected client: azureServiceClientBase.AzureServiceClientBase;
    constructor(client: azureServiceClientBase.AzureServiceClientBase);
    abstract createOrUpdate(deploymentName: any, deploymentParameters: any, callback: any): any;
    abstract validate(deploymentName: any, deploymentParameters: any, callback: any): any;
    getDeploymentResult(requestUri: any, callback: any): void;
    protected deployTemplate(requestUri: any, deploymentName: any, deploymentParameters: any, callback: any): any;
    protected validateTemplate(requestUri: any, deploymentName: any, deploymentParameters: any, callback: any): any;
}
