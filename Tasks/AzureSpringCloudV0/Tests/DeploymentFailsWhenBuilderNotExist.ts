import * as path from 'path';
import assert = require('assert');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { printTaskInputs } from './mock_utils';

export class DeploymentFailsWhenBuilderNotExist {

    private static mockTaskInputParameters() {
        //Just use this to set the environment variables before any of the pipeline SDK code runs.
        //The actual TaskMockRunner instance is irrelevant as inputs are set as environment variables,
        //visible to the whole process. If we do this in the L0 file, it doesn't work.
        //Otherwise, it doesn't work.
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner('dummypath');
        console.log('Setting mock inputs for DeploymentFailsWhenBuilderNotExist');
        tr.setInput('ConnectedServiceName', "AzureRM");
        tr.setInput('Action', 'Deploy');
        tr.setInput('AzureSpringCloud', 'DeploymentFailsWhenBuilderNotExistL0');
        tr.setInput('AppName', 'testapp');
        tr.setInput('UseStagingDeployment', "true");
        tr.setInput('Package', 'dummy.jar');
        tr.setInput('RuntimeVersion', 'Java_11');
        tr.setInput('EnvironmentVariables', '-key1 val1 -key2 "val2"');
        tr.setInput('DotNetCoreMainEntryPath', '/foobar.dll');
        tr.setInput('CreateNewDeployment', "false");
        tr.setInput('Builder', 'dummyBuilder');
        printTaskInputs();
    }

    public static mochaTest = (done: Mocha.Done) => {
        DeploymentFailsWhenBuilderNotExist.mockTaskInputParameters();
        let testPath = path.join(__dirname, 'DeploymentFailsWhenBuilderNotExistL0.js');
        let mockTestRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);
        try {
            mockTestRunner.run();
            let expectedError = "KPack builder does not exist";
            assert(mockTestRunner.errorIssues.length > 0 || mockTestRunner.stderr.length > 0, 'should have written to stderr');
            assert(mockTestRunner.stdErrContained(expectedError) || mockTestRunner.createdErrorIssue(expectedError), 'E should have said: ' + expectedError);
            done();
        }
        catch (error) {
            console.error(error);
            done(error);
        }
    }
}