import * as path from 'path';
import assert = require('assert');
import mocha = require('mocha');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { printTaskInputs } from './mock_utils';

export class SetNamedDeploymentFailsWhenDeploymentDoesNotExist {

    /**
     * @param targetDeploymentName The name of the target deployment
     */
    private static mockTaskInputParameters(targetDeploymentName: string) {
        //Just use this to set the environment variables before any of the pipeline SDK code runs.
        //The actual TaskMockRunner instance is irrelevant as inputs are set as environment variables,
        //visible to the whole process. If we do this in the L0 file, it doesn't work.
        //Otherwise, it doesn't work.
        let tr = new tmrm.TaskMockRunner('dummypath');
        tr.setInput('ConnectedServiceName', "AzureRM");
        tr.setInput('Action', 'Set Production');
        tr.setInput('AppName', 'testapp');
        tr.setInput('AzureSpringCloud', 'SetNamedDeploymentFailsWhenDeploymentDoesNotExistL0');
        tr.setInput('UseStagingDeployment', "false");
        tr.setInput('DeploymentName', targetDeploymentName);
        printTaskInputs();
    }

    public static mochaTestTargetDeploymentDoesNotExist = (done: mocha.Done) => {
        let taskPath = path.join(__dirname, 'SetNamedDeploymentFailsWhenDeploymentDoesNotExistL0.js');
        let mockTestRunner: ttm.MockTestRunner = new ttm.MockTestRunner(taskPath);
        SetNamedDeploymentFailsWhenDeploymentDoesNotExist.mockTaskInputParameters('nonexistingDeployment');
        try {
            mockTestRunner.run();
            assert(mockTestRunner.failed);
            let expectedError = 'loc_mock_StagingDeploymentWithNameDoesntExist nonexistingDeployment';
            assert(mockTestRunner.errorIssues.length > 0 || mockTestRunner.stderr.length > 0, 'should have written to stderr');
            assert(mockTestRunner.stdErrContained(expectedError) || mockTestRunner.createdErrorIssue(expectedError), 'E should have said: ' + expectedError);
            done();
        }
        catch (error) {
            done(error);
        }
    };

    public static mochaTestTargetDeploymentAlreadyProduction = (done: mocha.Done) => {
        let taskPath = path.join(__dirname, 'SetNamedDeploymentFailsWhenDeploymentDoesNotExistL0.js');
        let mockTestRunner: ttm.MockTestRunner = new ttm.MockTestRunner(taskPath);
        SetNamedDeploymentFailsWhenDeploymentDoesNotExist.mockTaskInputParameters('alreadyProduction');
        try {
            mockTestRunner.run();
            assert(mockTestRunner.failed);
            let expectedError = 'loc_mock_StagingDeploymentWithNameDoesntExist alreadyProduction';
            assert(mockTestRunner.errorIssues.length > 0 || mockTestRunner.stderr.length > 0, 'should have written to stderr');
            assert(mockTestRunner.stdErrContained(expectedError) || mockTestRunner.createdErrorIssue(expectedError), 'E should have said: ' + expectedError);
            done();
        }
        catch (error) {
            done(error);
        }
    };
}