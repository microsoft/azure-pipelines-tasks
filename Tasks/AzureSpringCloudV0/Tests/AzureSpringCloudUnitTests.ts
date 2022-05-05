
import { AzureEndpoint } from "azure-pipelines-tasks-azure-arm-rest-v2/azureModels";
import { getMockEndpoint, nock } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';
import { MOCK_RESOURCE_GROUP_NAME, API_VERSION } from "./mock_utils";
import assert = require('assert');

export class AzureSpringCloudUnitTests {

    static readonly AZURE_ENDPOINT: AzureEndpoint = getMockEndpoint();

    /**
     * Tests that deployment names are parsed correctly from API output.
     */
    public static testDeploymentNameRetrieval = (done: Mocha.Done) => {
        let azureSpringCloudName = 'testDeploymentNameRetrieval';
        let appName = 'testapp';
        let azureSpringCloud = AzureSpringCloudUnitTests.newAzureSpringCloud(azureSpringCloudName);
        AzureSpringCloudUnitTests.mockDeploymentListApiWithTwoDeployments(azureSpringCloudName, appName);
        let expectedDeploymentNames = ['default', 'theOtherOne'];
        azureSpringCloud.getAllDeploymentNames(appName)
            .then(foundDeploymentNames => {
                assert.deepStrictEqual(foundDeploymentNames, expectedDeploymentNames);
                done();
            })
            .catch(error => done(error));
    }

    /** Prepares an instance of the AzureSpringCloudWrapper with a mock endpoint */
    private static newAzureSpringCloud(name: string) {
        let asc = require('../deploymentProvider/azure-arm-spring-cloud');
        let azureSpringCloud = new asc.AzureSpringCloud(this.AZURE_ENDPOINT, `/subscriptions/${this.AZURE_ENDPOINT.subscriptionID}/resourceGroups/${MOCK_RESOURCE_GROUP_NAME}/providers/Microsoft.AppPlatform/Spring/${name}`)
        return azureSpringCloud;
    }

    private static mockDeploymentListApiWithTwoDeployments(azureSpringCloudName: string, appName: string) {
        console.log('mockDeploymentListApiWithTwoDeployments');

        nock('https://management.azure.com').get(`/subscriptions/${this.AZURE_ENDPOINT.subscriptionID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/Microsoft.AppPlatform/Spring/${azureSpringCloudName}/apps/${appName}/deployments?api-version=${API_VERSION}`)
            .reply(200, {
                "value": [
                    {
                        "id": `/subscriptions/${this.AZURE_ENDPOINT.subscriptionID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/Microsoft.AppPlatform/Spring/${azureSpringCloudName}/apps/${appName}/deployments/default`,
                        "name": "default",
                        "properties": {
                            "active": true,
                            "appName": appName,
                            "deploymentSettings": {
                                "cpu": 1,
                                "environmentVariables": null,
                                "memoryInGB": 1,
                                "runtimeVersion": "Java_8"
                            },
                            "instances": [
                                {
                                    "discoveryStatus": "UP",
                                    "name": `${appName}-default-7-7b77f5b6f5-fff9t`,
                                    "startTime": "2021-03-13T01:39:20Z",
                                    "status": "Running"
                                }
                            ],
                            "provisioningState": "Succeeded",
                            "source": {
                                "relativePath": "<default>",
                                "type": "Jar"
                            },
                            "status": "Running"
                        },
                        "resourceGroup": MOCK_RESOURCE_GROUP_NAME,
                        "sku": {
                            "capacity": 1,
                            "name": "S0",
                            "tier": "Standard"
                        },
                        "type": `providers/Microsoft.AppPlatform/Spring/apps/deployments`
                    },
                    {
                        "id": `/subscriptions/${this.AZURE_ENDPOINT.subscriptionID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/Microsoft.AppPlatform/Spring/${azureSpringCloudName}/apps/${appName}/deployments/theOtherOne`,
                        "name": "theOtherOne",
                        "properties": {
                            "active": true,
                            "appName": appName,
                            "deploymentSettings": {
                                "cpu": 1,
                                "environmentVariables": null,
                                "memoryInGB": 1,
                                "runtimeVersion": "Java_8"
                            },
                            "instances": [
                                {
                                    "discoveryStatus": "UP",
                                    "name": `${appName}-theOtherOne-7-7b77f5b6f5-90210`,
                                    "startTime": "2021-03-13T01:39:20Z",
                                    "status": "Running"
                                }
                            ],
                            "provisioningState": "Succeeded",
                            "source": {
                                "relativePath": "<default>",
                                "type": "Jar"
                            },
                            "status": "Running"
                        },
                        "resourceGroup": MOCK_RESOURCE_GROUP_NAME,
                        "sku": {
                            "capacity": 1,
                            "name": "S0",
                            "tier": "Standard"
                        },
                        "type": 'Microsoft.AppPlatform/Spring/apps/deployments'
                    }
                ]

            }).persist();
    }
}