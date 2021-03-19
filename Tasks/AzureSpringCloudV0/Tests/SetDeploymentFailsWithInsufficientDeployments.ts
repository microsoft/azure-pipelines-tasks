import * as path from 'path';
import assert = require('assert');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { printTaskInputs } from './mock_utils';

export class SetDeploymentFailsWithInsufficientDeployments {

    private static mockTaskInputParameters() {
        //Just use this to set the environment variables before any of the pipeline SDK code runs.
        //The actual TaskMockRunner instance is irrelevant as inputs are set as environment variables,
        //visible to the whole process. If we do this in the L0 file, it doesn't work.
        //Otherwise, it doesn't work.
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner('dummypath');
        console.log('Setting mock inputs for SetDeploymentFailsWithInsufficientDeployments');
        tr.setInput('ConnectedServiceName', "AzureRM");
        tr.setInput('Action', 'Deploy');
        tr.setInput('AzureSpringCloud', 'SetDeploymentFailsWithInsufficientDeploymentL0');
        tr.setInput('AppName', 'testapp');
        tr.setInput('TargetInactive', "true");
        tr.setInput('Package', 'dummy.jar');
        tr.setInput('RuntimeVersion', 'Java_11');
        tr.setInput('CreateNewDeployment', "false");
        printTaskInputs();
    }

    public static mochaTest = (done: Mocha.Done) => {
        
        SetDeploymentFailsWithInsufficientDeployments.mockTaskInputParameters();
        let testPath = path.join(__dirname, 'SetDeploymentFailsWithInsufficientDeploymentsL0.js');
        let mockTestRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);
        try {
            mockTestRunner.run();
            console.log('---------- Run completed ------------------');
            console.log('STDOUT: '+mockTestRunner.stdout);
            console.error('STDERR: '+ mockTestRunner.stderr);
            assert(mockTestRunner.failed);
            let expectedError = 'No staging deployment found';
            assert(mockTestRunner.errorIssues.length > 0 || mockTestRunner.stderr.length > 0, 'should have written to stderr');
            assert(mockTestRunner.stdErrContained(expectedError) || mockTestRunner.createdErrorIssue(expectedError), 'E should have said: ' + expectedError);
            done();
        }
        catch (error) {
            done(error);
        }
    };
}