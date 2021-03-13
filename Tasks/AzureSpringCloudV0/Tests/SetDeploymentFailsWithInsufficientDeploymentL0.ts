import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';
import tl = require('azure-pipelines-task-lib');
import { TaskParameters, TaskParametersUtility } from '../operations/taskparameters';
import { removeListener } from 'process';
import { main } from '../azurespringclouddeployment';

console.log('Before getMockEndpoint');

getMockEndpoint();

export class TestSetDeploymentFailsWithInsufficientDeployments {
    public static async testWithNoDeployments() {
        let taskParameters: TaskParameters = TaskParametersUtility.getParameters();
        console.log('Starting main');
        main().catch(error => {
            tl.setResult(tl.TaskResult.Failed, error);
        }).then(function () { 
            console.log("task succeeded.") 
        });
        console.log('Main started');

    }
}
