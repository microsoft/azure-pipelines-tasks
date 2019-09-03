import msRestAzure = require('./azure-arm-common');
import azureServiceClientBase = require('./AzureServiceClientBase');
import depolymentsBase = require('./DeploymentsBase');

export class ManagementGroupManagementClient extends azureServiceClientBase.AzureServiceClientBase {

    public deployments: ManagementGroupDeployments;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, managementGroupId: string, options?: any) {
        super(credentials);

        this.apiVersion = (credentials.isAzureStackEnvironment) ? '2016-06-01' : '2019-05-10';
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;
        if (!!options && !!options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        this.deployments = new ManagementGroupDeployments(this);
        this.managementGroupId = managementGroupId;
    }
}

export class ManagementGroupDeployments extends depolymentsBase.DeploymentsBase {
    
    constructor(client: ManagementGroupManagementClient) {
        super(client);
    }

    public deploy(deploymentName, deploymentParameters, callback) {

        // Create HTTP request uri
        var requestUri = this.client.getRequestUri(
            '//providers/Microsoft.Management/managementGroups/{managementGroupId}/providers/Microsoft.Resources/deployments/{deploymentName}', 
            {
                '{deploymentName}': deploymentName
            }
        );
        super.createOrUpdate(requestUri, deploymentName, deploymentParameters, callback);
    }

    public validate(deploymentName, deploymentParameters, callback) {

        // Create HTTP request uri
        var requestUri = this.client.getRequestUri(
            '//providers/Microsoft.Management/managementGroups/{managementGroupId}/providers/Microsoft.Resources/deployments/{deploymentName}/validate',
            {
                '{deploymentName}': deploymentName
            }
        );
        super.validate(requestUri, deploymentName, deploymentParameters, callback);
    }
}