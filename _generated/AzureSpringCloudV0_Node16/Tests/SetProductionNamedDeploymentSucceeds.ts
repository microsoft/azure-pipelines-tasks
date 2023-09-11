import * as path from 'path';
import assert = require('assert');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { printTaskInputs } from './mock_utils';

export class SetProductionNamedDeploymentSucceeds {

    private static mockTaskInputParameters() {
        //Just use this to set the environment variables before any of the pipeline SDK code runs.
        //The actual TaskMockRunner instance is irrelevant as inputs are set as environment variables,
        //visible to the whole process. If we do this in the L0 file, it doesn't work.
        //Otherwise, it doesn't work.
        let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner('dummypath');
        tr.setInput('ConnectedServiceName', "AzureRM");
        tr.setInput('Action', 'Set Production');
        tr.setInput('AzureSpringCloud', 'SetProductionNamedDeploymentSucceedsL0');
        tr.setInput('AppName', 'testapp');
        tr.setInput('UseStagingDeployment', "false");
        tr.setInput('DeploymentName', 'theOtherOne');
        printTaskInputs();
    }

    public static mochaTest = (done: Mocha.Done) => {

        SetProductionNamedDeploymentSucceeds.mockTaskInputParameters();
        let testPath = path.join(__dirname, 'SetProductionNamedDeploymentSucceedsL0.js');
        let mockTestRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);
        try {
            mockTestRunner.run();
            assert(mockTestRunner.succeeded);
            assert(mockTestRunner.errorIssues.length == 0);
            done();
        }
        catch (error) {
            done(error);
        }
    };
}