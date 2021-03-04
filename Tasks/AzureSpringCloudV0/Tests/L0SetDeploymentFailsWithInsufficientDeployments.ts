import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';
import { PackageType } from 'webdeployment-common-v2/packageUtility';
import tl = require('azure-pipelines-task-lib');
import { TaskParameters, TaskParametersUtility } from '../operations/taskparameters';
import { removeListener } from 'process';

getMockEndpoint();

export class TestSetDeploymentFailsWithInsufficientDeployments  {
    public static async testWithNoDeployments() {
        var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
    }
}