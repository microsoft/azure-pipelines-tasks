import * as path from 'path';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { setEndpointData, setAgentsData, mockTaskArgument, nock, MOCK_SUBSCRIPTION_ID, mockAzureSpringAppsExists, mockCommonAzureAPIs, API_VERSION } from './mock_utils';
import { ASC_RESOURCE_TYPE, MOCK_RESOURCE_GROUP_NAME } from './mock_utils'
import assert = require('assert');

export class DeleteStagingDeploymentTestL0 {

    static readonly TEST_NAME = 'DeleteStagingDeploymentTestL0';
    static readonly MOCK_APP_NAME = 'testapp';

    public static startTest() {
        console.log(`running ${this.TEST_NAME}`);
        let taskPath = path.join(__dirname, '..', 'azurespringappsdeployment.js');
        let taskMockRunner: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
        setEndpointData();
        setAgentsData();
        mockCommonAzureAPIs();
        mockAzureSpringAppsExists(this.TEST_NAME);
        this.mockTwoDeployments();
        this.mockDeploymentDeleteStagingDeployment();
        taskMockRunner.setAnswers(mockTaskArgument());
        taskMockRunner.run();
    }

    /**
    * Simulate a deployment list API that returns a production deployment and a staging deployment.
    */
    private static mockTwoDeployments() {
        nock('https://management.azure.com', {
            reqheaders: {
                "authorization": "Bearer DUMMY_ACCESS_TOKEN",
                "content-type": "application/json; charset=utf-8",
                "user-agent": "TFS_useragent"
            }
        }).get(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}/apps/${this.MOCK_APP_NAME}/deployments?api-version=${API_VERSION}`)
            .reply(200, {
                "value": [
                    {
                        "id": `/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}/apps/${this.MOCK_APP_NAME}/deployments/default`,
                        "name": "default",
                        "properties": {
                            "active": true,
                            "appName": this.MOCK_APP_NAME,
                            "deploymentSettings": {
                                "cpu": 1,
                                "environmentVariables": null,
                                "memoryInGB": 1,
                                "runtimeVersion": "Java_8"
                            },
                            "instances": [
                                {
                                    "discoveryStatus": "UP",
                                    "name": `${this.MOCK_APP_NAME}-default-7-7b77f5b6f5-fff9t`,
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
                        "type": `${ASC_RESOURCE_TYPE}/apps/deployments`
                    },
                    {
                        "id": `/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}/apps/${this.MOCK_APP_NAME}/deployments/theOtherOne`,
                        "name": "theOtherOne",
                        "properties": {
                            "active": false,
                            "appName": this.MOCK_APP_NAME,
                            "deploymentSettings": {
                                "cpu": 1,
                                "environmentVariables": null,
                                "memoryInGB": 1,
                                "runtimeVersion": "Java_8"
                            },
                            "instances": [
                                {
                                    "discoveryStatus": "UP",
                                    "name": `${this.MOCK_APP_NAME}-theOtherOne-7-7b77f5b6f5-90210`,
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
                        "type": `${ASC_RESOURCE_TYPE}/apps/deployments`
                    }]

            }).persist();
    }

    private static mockDeploymentDeleteStagingDeployment() {
        nock('https://management.azure.com', {
            reqheaders: {
                "authorization": "Bearer DUMMY_ACCESS_TOKEN",
                "content-type": "application/json; charset=utf-8",
                "user-agent": "TFS_useragent"
            }
        }).delete(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}/apps/${this.MOCK_APP_NAME}/deployments/theOtherOne?api-version=${API_VERSION}`)
            .once()
            .reply(200);
    }
}

DeleteStagingDeploymentTestL0.startTest();
