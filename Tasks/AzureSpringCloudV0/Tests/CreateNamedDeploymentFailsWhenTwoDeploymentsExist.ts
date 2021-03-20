import * as path from 'path';
import assert = require('assert');
import mocha = require('mocha');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { printTaskInputs } from './mock_utils';

export class CreateNamedDeploymentFailsWhenTwoDeploymentsExist {
    
    private static mockTaskInputParameters() {
        //Just use this to set the environment variables before any of the pipeline SDK code runs.
        //The actual TaskMockRunner instance is irrelevant as inputs are set as environment variables,
        //visible to the whole process. If we do this in the L0 file, it doesn't work.
        //Otherwise, it doesn't work.
        let tr = new tmrm.TaskMockRunner('dummypath');
        tr.setInput('ConnectedServiceName', "AzureRM");
        tr.setInput('Action', 'Deploy');
        tr.setInput('AppName', 'testapp');
        tr.setInput('AzureSpringCloud', 'CreateNamedDeploymentFailsWhenTwoDeploymentsExistL0');
        tr.setInput('TargetInactive', "false");
        tr.setInput('Package', 'dummy.jar');
        tr.setInput( 'RuntimeVersion', 'Java_11');
        tr.setInput('CreateNewDeployment', "true");
        tr.setInput('DeploymentNameForDeploy', 'shouldntBeAbleToCreateThis');
        printTaskInputs();
    }
    
    public static mochaTest = (done: mocha.Done) => {
      
        let taskPath = path.join(__dirname, 'CreateNamedDeploymentFailsWhenTwoDeploymentsExistL0.js');
        let mockTestRunner: ttm.MockTestRunner = new ttm.MockTestRunner(taskPath);
        CreateNamedDeploymentFailsWhenTwoDeploymentsExist.mockTaskInputParameters();
        try {
            mockTestRunner.run();
            console.log('Run completed');
            console.log('STDOUT: '+mockTestRunner.stdout);
            console.error('STDERR: '+ mockTestRunner.stderr);
            assert(mockTestRunner.failed);
            let expectedError = 'Deployment with name shouldntBeAbleToCreateThis does not exist and cannot be created, as two deployments already exist.';
            assert(mockTestRunner.errorIssues.length > 0 || mockTestRunner.stderr.length > 0, 'should have written to stderr');
            assert(mockTestRunner.stdErrContained(expectedError) || mockTestRunner.createdErrorIssue(expectedError), 'E should have said: ' + expectedError);
            done();
        }
        catch (error) {
            done(error);
        }
    };
    
}