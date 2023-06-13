import * as path from 'path';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { setEndpointData, setAgentsData, mockTaskArgument, nock, MOCK_SUBSCRIPTION_ID, mockAzureSpringAppsExists, mockCommonAzureAPIs, API_VERSION } from './mock_utils';
import { ASC_RESOURCE_TYPE, MOCK_RESOURCE_GROUP_NAME } from './mock_utils'
import assert = require('assert');


const MOCK_SAS_URL = "https://mockFileShare.file.core.windows.net/mockId/resources/mockId2?sv=2018-03-28&sr=f&sig=%2Bh3X40ta1Oyp0Lar6Fg99MXVmTR%2BHm109ZbuwCCCus0%3D&se=2020-12-03T06%3A06%3A13Z&sp=w";
const MOCK_RELATIVE_PATH = "resources/c256e6792411d5e86bbe81265a60f62cdf5d7d9eb70fa8f303baf95ec84bb7f7-2020120304-2a3a6867-3a9f-41fd-bef9-e18e52d2e55a";
const MOCK_DEPLOYMENT_STATUS_ENDPOINT = `/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${MOCK_RESOURCE_GROUP_NAME}/providers/Microsoft.AppPlatform/locations/eastus2/operationStatus/default/operationId/mockoperationid?api-version=${API_VERSION}`

export class DeploymentToStagingSucceedsL0 {

    static readonly TEST_NAME = 'DeploymentToStagingSucceedsL0';
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
        let nockScope = this.mockDeploymentApis();

        taskMockRunner.registerMock('./azure-storage', {
            uploadFileToSasUrl: async function (sasUrl: string, localPath: string) {
                console.log('Executing mock upload to storage');
                assert.strictEqual(sasUrl, MOCK_SAS_URL, "Attempting to upload to unexpected SAS URL");
                assert.strictEqual(localPath, "dummy.jar", "Attempting to upload path other than the one provided");
            }
        });
        taskMockRunner.setAnswers(mockTaskArgument());
        taskMockRunner.registerMockExport('getPathInput', (name: string, required?: boolean, check?: boolean) => 'dummy.jar');
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

    /** Simulate APIs invoked as part of deployment */
    private static mockDeploymentApis() {
        //mock get resource upload URL
        nock('https://management.azure.com', {
            reqheaders: {
                "authorization": "Bearer DUMMY_ACCESS_TOKEN",
                "content-type": "application/json; charset=utf-8",
                "user-agent": "TFS_useragent"
            }
        })
            .post(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${MOCK_RESOURCE_GROUP_NAME}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}/apps/${this.MOCK_APP_NAME}/getResourceUploadUrl?api-version=${API_VERSION}`)
            .once()
            .reply(200,
                {
                    "relativePath": MOCK_RELATIVE_PATH,
                    "uploadUrl": MOCK_SAS_URL
                }
            )


            // mock listTestKeys
            .post(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${MOCK_RESOURCE_GROUP_NAME}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}/listTestKeys?api-version=${API_VERSION}`)
            .once()
            .reply(200,
                {
                    "primaryKey": "mockPrimaryKey",
                    "secondaryKey": "mockSecondaryKey",
                    "primaryTestEndpoint": `https://primary:mockPrimaryKey@${this.MOCK_APP_NAME}.test.azuremicroservices.io`,
                    "secondaryTestEndpoint": `https://secondary:mockSecondaryKey@${this.MOCK_APP_NAME}.test.azuremicroservices.io`,
                    "enabled": true
                }
            )

            // Mock the deployment update API:
            .patch(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}/apps/${this.MOCK_APP_NAME}/deployments/theOtherOne?api-version=${API_VERSION}`)
            .once()
            .reply((uri, serializedRequestBody) => {
                let requestBody = JSON.parse(serializedRequestBody);
                assert.strictEqual(requestBody.properties.source.relativePath, MOCK_RELATIVE_PATH);
                assert.strictEqual(requestBody.properties.deploymentSettings.runtimeVersion, 'Java_11');
                assert.strictEqual(requestBody.properties.deploymentSettings.environmentVariables.key1, 'val1');
                assert.strictEqual(requestBody.properties.deploymentSettings.environmentVariables.key2, "val     2");
                //We'd never have the .NET entry path parameter in a Java app in the real world,
                //but we'll take this opportunity to ensure it's properly propagated when set as a task param.
                assert.strictEqual(requestBody.properties.deploymentSettings.netCoreMainEntryPath, '/foobar.dll');
                let responseBody = {
                    "provisioningState": "Updating"
                }
                let returnHeaders = {
                    'azure-asyncoperation': 'https://management.azure.com' + MOCK_DEPLOYMENT_STATUS_ENDPOINT
                }
                return [202, responseBody, returnHeaders];

            })

            // Mock the operation status URL
            .get(MOCK_DEPLOYMENT_STATUS_ENDPOINT)
            .once()
            .reply(200, {
                status: "Completed"
            })

            // Mock the service information API
            .get(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}?api-version=${API_VERSION}`)
            .once()
            .reply(200,{
                "sku": {
                    "name": "S0",
                    "tier": "Standard",
                    "capacity": 0
                }
            })

            .persist();

    }
}

DeploymentToStagingSucceedsL0.startTest();