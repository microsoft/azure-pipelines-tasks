import * as path from 'path';
import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import {setEndpointData, setAgentsData, mockTaskArgument, mockCommonAzureAPIs, nock} from './mock_utils';
import {ASC_RESOURCE_TYPE, MOCK_RESOURCE_GROUP_NAME, MOCK_SUBSCRIPTION_ID, MOCK_SPRING_CLOUD_NAME, MOCK_APP_NAME} from './mock_utils'
import webClient = require('azure-pipelines-tasks-azure-arm-rest-v2/webClient');

const TEST_APP_NAME='testapp';

export class SetDeploymentFailsWithInsufficientDeployment{
   

    private static mockTaskInputParameters(tr: tmrm.TaskMockRunner) {
        tr.setInput("ConnectedServiceName", "AzureRM");
        tr.setInput('Action', 'Deploy');
        tr.setInput('AzureSpringCloud', MOCK_SPRING_CLOUD_NAME);
        tr.setInput('AppName', MOCK_APP_NAME);
        tr.setInput('TargetInactive', "true");
        tr.setInput('Package', 'dummy.jar');
        tr.setInput('RuntimeVersion', 'Java_11');
    }

    public static startTest(){
        console.log('running startTest');
        let testPath = path.join(__dirname, 'SetDeploymentFailsWithInsufficientDeploymentL0.js');
        let testRunner : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(testPath);
        SetDeploymentFailsWithInsufficientDeployment.mockTaskInputParameters(testRunner);
        setEndpointData();
        setAgentsData();
        mockCommonAzureAPIs();
        this.mockDeploymentListApiWithSingleDeployment();

        testRunner.setAnswers(mockTaskArgument());
        testRunner.run();
    }    


    /**
     * Simulate a deployment list API that returns a single Production deployment.
     */
    private static mockDeploymentListApiWithSingleDeployment(){
        nock('https://management.azure.com', {
            reqheaders: {
                "authorization": "Bearer DUMMY_ACCESS_TOKEN",
                "content-type": "application/json; charset=utf-8",
                "user-agent": "TFS_useragent"
            }
        }).get(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${MOCK_SPRING_CLOUD_NAME}/apps/${MOCK_APP_NAME}/deployments?api-version=2020-07-01`)
            .reply(200, {
                "value": [
                    {
                        "id": "/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${springCloudName}/apps/${appName}/deployments/default",
                        "name": "default",
                        "properties": {
                            "active": true,
                            "appName": MOCK_APP_NAME,
                            "deploymentSettings": {
                                "cpu": 1,
                                "environmentVariables": null,
                                "memoryInGB": 1,
                                "runtimeVersion": "Java_8"
                            },
                            "instances": [
                                {
                                    "discoveryStatus": "UP",
                                    "name": `${MOCK_APP_NAME}-default-7-7b77f5b6f5-fff9t`,
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
}

SetDeploymentFailsWithInsufficientDeployment.startTest();