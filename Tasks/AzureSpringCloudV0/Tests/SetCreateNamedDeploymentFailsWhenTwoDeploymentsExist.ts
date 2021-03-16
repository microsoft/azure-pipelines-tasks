import * as path from 'path';
import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import {setEndpointData, setAgentsData, mockTaskArgument, mockCommonAzureAPIs, nock, mockAzureSpringCloudExists} from './mock_utils';
import {ASC_RESOURCE_TYPE, MOCK_RESOURCE_GROUP_NAME, MOCK_SUBSCRIPTION_ID} from './mock_utils'
import assert = require('assert');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { Inputs } from '../operations/taskparameters';

const TEST_APP_NAME='testapp';

export class SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist {

    private static readonly TEST_NAME='SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist';
    public static mochaTest = (done: MochaDone) => {
      
        let taskPath = path.join(__dirname, 'SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist.js');
        let mockTestRunner: ttm.MockTestRunner = new ttm.MockTestRunner(taskPath);
        try {
            mockTestRunner.run();
            console.log('Run completed');
            console.log('STDOUT: '+mockTestRunner.stdout);
            console.error('STDERR: '+ mockTestRunner.stderr);
            assert(mockTestRunner.failed);
            let expectedError = 'Two deployments already exist';
            assert(mockTestRunner.errorIssues.length > 0 || mockTestRunner.stderr.length > 0, 'should have written to stderr');
            assert(mockTestRunner.stdErrContained(expectedError) || mockTestRunner.createdErrorIssue(expectedError), 'E should have said: ' + expectedError);
            done();
        }
        catch (error) {
            done(error);
        }
    };
   

    private static mockTaskInputParameters(tr: tmrm.TaskMockRunner) {
        console.log('Test name is: ' + SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist.TEST_NAME)
        tr.setInput(Inputs.connectedServiceName, "AzureRM");
        tr.setInput(Inputs.action, 'Deploy');
        tr.setInput(Inputs.azureSpringCloud, SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist.TEST_NAME);
        tr.setInput(Inputs.appName, TEST_APP_NAME);
        tr.setInput(Inputs.targetInactive, "false");
        tr.setInput(Inputs.package, '.');
        tr.setInput(Inputs.runtimeVersion, 'Java_11');
        tr.setInput(Inputs.createNewDeployment, "true");
        tr.setInput(Inputs.deploymentName, 'shouldntBeAbleToCreateThis');
    }

    public static startTest(){
        console.log(`running ${this.TEST_NAME}`);
        let taskPath = path.join(__dirname, '..', 'azurespringclouddeployment.js');
        let taskMockRunner : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
        this.mockTaskInputParameters(taskMockRunner);
        setEndpointData();
        setAgentsData();
        mockCommonAzureAPIs();
        mockAzureSpringCloudExists(this.TEST_NAME);
        this.mockDeploymentListApiWithTwoDeployments();
        taskMockRunner.setAnswers(mockTaskArgument());
        taskMockRunner.run();
    }    


    /**
     * Simulate a deployment list API that returns a single Production deployment.
     */
    private static mockDeploymentListApiWithTwoDeployments(){
        console.log('mockDeploymentListApiWithTwoDeployments');
        nock('https://management.azure.com', {
            reqheaders: {
                "authorization": "Bearer DUMMY_ACCESS_TOKEN",
                "content-type": "application/json; charset=utf-8",
                "user-agent": "TFS_useragent"
            }
        }).get(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist.TEST_NAME}/apps/${TEST_APP_NAME}/deployments?api-version=2020-07-01`)
            .reply(200, {
                "value": [
                    {
                        "id": `/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist.TEST_NAME}/apps/${TEST_APP_NAME}/deployments/default`,
                        "name": "default",
                        "properties": {
                            "active": true,
                            "appName": TEST_APP_NAME,
                            "deploymentSettings": {
                                "cpu": 1,
                                "environmentVariables": null,
                                "memoryInGB": 1,
                                "runtimeVersion": "Java_8"
                            },
                            "instances": [
                                {
                                    "discoveryStatus": "UP",
                                    "name": `${TEST_APP_NAME}-default-7-7b77f5b6f5-fff9t`,
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
                        "id": `/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist.TEST_NAME}/apps/${TEST_APP_NAME}/deployments/theOtherOne`,
                        "name": "theOtherOne",
                        "properties": {
                            "active": true,
                            "appName": TEST_APP_NAME,
                            "deploymentSettings": {
                                "cpu": 1,
                                "environmentVariables": null,
                                "memoryInGB": 1,
                                "runtimeVersion": "Java_8"
                            },
                            "instances": [
                                {
                                    "discoveryStatus": "UP",
                                    "name": `${TEST_APP_NAME}-theOtherOne-7-7b77f5b6f5-90210`,
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
                    }
                ]
    
            }).persist();
    }
}

SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist.startTest();