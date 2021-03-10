import * as path from 'path';
import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import {setEndpointData, setAgentsData} from './mock_utils';

export class SetDeploymentFailsWithInsufficientDeployment{

    private static mockTaskInputParameters(tr: tmrm.TaskMockRunner) {
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('Action', 'Deploy');
        tr.setInput('AzureSpringCloud', 'asc-task-test-l0');
        tr.setInput('AppName', 'testapp');
        tr.setInput('TargetInactive', "true");
    }

    public static startTest(){
        console.log('running startTest');
        let testPath = path.join(__dirname, 'SetDeploymentFailsWithInsufficientDeploymentL0.js');
        let testRunner : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(testPath);
        SetDeploymentFailsWithInsufficientDeployment.mockTaskInputParameters(testRunner);
        setEndpointData();
        setAgentsData();

        testRunner.registerMock('azure-arm-spring-cloud',{
            AzureSpringCloud: {
                sendRequest: function(method, url, body){
                    console.log(`Invoked ${method} on ${url}`);
                }
            }
        
        });

        testRunner.run();
    }

    
}

SetDeploymentFailsWithInsufficientDeployment.startTest();