import * as path from 'path';
import assert = require('assert');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { printTaskInputs } from './mock_utils';

export class DeploymentToStagingSucceeds {

    private static mockTaskInputParameters() {
        //Just use this to set the environment variables before any of the pipeline SDK code runs.
        //The actual TaskMockRunner instance is irrelevant as inputs are set as environment variables,
        //visible to the whole process. If we do this in the L0 file, it doesn't work.
        //Otherwise, it doesn't work.
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner('dummypath');
        console.log('Setting mock inputs for DeploymentToStagingSucceeds');
        tr.setInput('ConnectedServiceName', "AzureRM");
        tr.setInput('Action', 'Deploy');
        tr.setInput('AzureSpringCloud', 'DeploymentToStagingSucceedsL0');
        tr.setInput('AppName', 'testapp');
        tr.setInput('UseStagingDeployment', "true");
        tr.setInput('Package', 'dummy.jar');
        tr.setInput('RuntimeVersion', 'Java_11');
        tr.setInput('CreateNewDeployment', "false");
        printTaskInputs();
    }

    public static mochaTest = (done: Mocha.Done) => {
        
        DeploymentToStagingSucceeds.mockTaskInputParameters();
        let testPath = path.join(__dirname, 'DeploymentToStagingSucceedsL0.js');
        let mockTestRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);
        try {
            mockTestRunner.run();
            console.log('---------- Run completed ------------------');
            console.log('STDOUT: '+mockTestRunner.stdout);
            console.error('STDERR: '+ mockTestRunner.stderr);
            
            assert.deepEqual(mockTestRunner.errorIssues, [], 'No error output expected in a successful deployment');
            assert(mockTestRunner.succeeded);
            done();
        }
        catch (error) {
            console.error(error);
            done(error);
        }
    };
}