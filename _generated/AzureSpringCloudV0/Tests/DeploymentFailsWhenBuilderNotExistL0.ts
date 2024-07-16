import * as path from 'path';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { setEndpointData, setAgentsData, mockTaskArgument, nock, MOCK_SUBSCRIPTION_ID, mockAzureSpringAppsExists, mockCommonAzureAPIs, API_VERSION  } from './mock_utils';
import { ASC_RESOURCE_TYPE, MOCK_RESOURCE_GROUP_NAME } from './mock_utils'
import assert = require('assert');

const MOCK_SAS_URL = "https://mockFileShare.file.core.windows.net/mockId/resources/mockId2?sv=2018-03-28&sr=f&sig=%2Bh3X40ta1Oyp0Lar6Fg99MXVmTR%2BHm109ZbuwCCCus0%3D&se=2020-12-03T06%3A06%3A13Z&sp=w";
const MOCK_RELATIVE_PATH = "resources/c256e6792411d5e86bbe81265a60f62cdf5d7d9eb70fa8f303baf95ec84bb7f7-2020120304-2a3a6867-3a9f-41fd-bef9-e18e52d2e55a";
const MOCK_TRIGGERED_BUILD_RESULT_ID = `/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${MOCK_RESOURCE_GROUP_NAME}/providers/${ASC_RESOURCE_TYPE}/DeploymentFailsWhenBuilderNotExistL0/buildServices/default/builds/testapp/results/1`;

export class DeploymentFailsWhenBuilderNotExistL0 {

    static readonly TEST_NAME = 'DeploymentFailsWhenBuilderNotExistL0';
    static readonly MOCK_APP_NAME = 'testapp';
    static readonly MOCK_TRIGGERED_BUILD_RESULT_ID = `/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${MOCK_RESOURCE_GROUP_NAME}/providers/${ASC_RESOURCE_TYPE}/DeploymentFailsWhenBuilderNotExistL0/buildServices/default/builds/testapp/results/1`;

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
                            "name": "E0",
                            "tier": "Enterprise"
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
                            "name": "E0",
                            "tier": "Enterprise"
                        },
                        "type": `${ASC_RESOURCE_TYPE}/apps/deployments`
                    }]

            }).persist();
    }

    /** 
     * Simulate APIs invoked as part of deployment.
     */
    private static mockDeploymentApis() {
        nock('https://management.azure.com', {
            reqheaders: {
                "authorization": "Bearer DUMMY_ACCESS_TOKEN",
                "content-type": "application/json; charset=utf-8",
                "user-agent": "TFS_useragent"
            }
        })

            // Mock the service information API
            .get(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}?api-version=${API_VERSION}`)
            .once()
            .reply(200,{
                "sku": {
                    "name": "E0",
                    "tier": "Enterprise",
                    "capacity": 1
                }
            })

            // Mock getResourceUploadUrl with build service
            .post(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${MOCK_RESOURCE_GROUP_NAME}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}/buildServices/default/getResourceUploadUrl?api-version=${API_VERSION}`)
            .once()
            .reply(200, {
                "relativePath": MOCK_RELATIVE_PATH,
                "uploadUrl": MOCK_SAS_URL
            })

            // Mock update KPack build
            .put(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${MOCK_RESOURCE_GROUP_NAME}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}/buildServices/default/builds/testapp?api-version=${API_VERSION}`)
            .once()
            .reply(200, {
                "properties":  {
                    "triggeredBuildResult": {
                        "id": MOCK_TRIGGERED_BUILD_RESULT_ID
                    }
                }
            })

            // Mock KPack build finish
            .get(`${MOCK_TRIGGERED_BUILD_RESULT_ID}?api-version=${API_VERSION}`)
            .once()
            .reply(404, {
                "error": {
                    "code": "NotFound",
                    "message": "KPack builder does not exist",
                    "target": "default/dummyBuilder",
                    "details": null
                }
            })

            .persist();
    }
}

DeploymentFailsWhenBuilderNotExistL0.startTest();
