import * as path from 'path';
import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import {setEndpointData, setAgentsData, mockTaskArgument, nock, MOCK_SUBSCRIPTION_ID, mockAzureSpringCloudExists, mockCommonAzureAPIs} from './mock_utils';
import {ASC_RESOURCE_TYPE, MOCK_RESOURCE_GROUP_NAME } from './mock_utils'
import assert = require('assert');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { Inputs } from '../operations/taskparameters';


export class SetDeploymentFailsWithInsufficientDeployment{
    
    static readonly TEST_NAME='SetDeploymentFailsWithInsufficientDeployment';
    static readonly MOCK_APP_NAME='testapp';

    public static mochaTest = (done: MochaDone) => {
      
        let tp = path.join(__dirname, 'SetDeploymentFailsWithInsufficientDeployment.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            console.log('Run completed');
            console.log('STDOUT: '+tr.stdout);
            console.error('STDERR: '+ tr.stderr);
            assert(tr.failed);
            let expectedError = 'No staging deployment found';
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.stdErrContained(expectedError) || tr.createdErrorIssue(expectedError), 'E should have said: ' + expectedError);
            done();
        }
        catch (error) {
            done(error);
        }
    };
   

    private static mockTaskInputParameters(tr: tmrm.TaskMockRunner) {
        tr.setInput(Inputs.connectedServiceName, "AzureRM");
        tr.setInput(Inputs.action, 'Deploy');
        tr.setInput(Inputs.azureSpringCloud, this.TEST_NAME);
        tr.setInput(Inputs.appName, this.MOCK_APP_NAME);
        tr.setInput(Inputs.targetInactive, "true");
        tr.setInput(Inputs.package, '.');
        tr.setInput(Inputs.runtimeVersion, 'Java_11');
        tr.setInput(Inputs.createNewDeployment, "false");
    }

    public static startTest(){
        console.log('running SetDeploymentFailsWithInsufficientDeployment');
        let taskPath = path.join(__dirname, '..', 'azurespringclouddeployment.js');
        let taskMockRunner : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
        setEndpointData();
        setAgentsData();
        mockCommonAzureAPIs();
        this.mockTaskInputParameters(taskMockRunner);
        mockAzureSpringCloudExists(this.TEST_NAME);
        this.mockDeploymentListApiWithSingleDeployment();

        taskMockRunner.setAnswers(mockTaskArgument());
        taskMockRunner.run();
    }    


    /**
     * Simulate a deployment list API that returns a single Production deployment.
     */
    private static mockDeploymentListApiWithSingleDeployment(){
        console.log('mockDeploymentListApiWithSingleDeployment');
        nock('https://management.azure.com', {
            reqheaders: {
                "authorization": "Bearer DUMMY_ACCESS_TOKEN",
                "content-type": "application/json; charset=utf-8",
                "user-agent": "TFS_useragent"
            }
        }).get(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/${ASC_RESOURCE_TYPE}/${this.TEST_NAME}/apps/${this.MOCK_APP_NAME}/deployments?api-version=2020-07-01`)
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
                    }]
    
            }).persist();
    }
}

SetDeploymentFailsWithInsufficientDeployment.startTest();