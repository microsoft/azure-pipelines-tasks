import * as path from 'path';
import assert = require('assert');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { printTaskInputs } from './mock_utils';

export class DeploymentCustomImageToStagingSucceeds {

    private static mockTaskInputParameters() {
        //Just use this to set the environment variables before any of the pipeline SDK code runs.
        //The actual TaskMockRunner instance is irrelevant as inputs are set as environment variables,
        //visible to the whole process. If we do this in the L0 file, it doesn't work.
        //Otherwise, it doesn't work.
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner('dummypath');
        console.log('Setting mock inputs for DeploymentCustomImageToStagingSucceedsL0');
        tr.setInput('ConnectedServiceName', "AzureRM");
        tr.setInput('Action', 'Deploy');
        tr.setInput('AzureSpringCloud', 'DeploymentCustomImageToStagingSucceedsL0');
        tr.setInput('AppName', 'testcontainerapp');
        tr.setInput('DeploymentType', 'CustomContainer');
        tr.setInput('UseStagingDeployment', "true");
        tr.setInput('RegistryUsername', 'username');
        tr.setInput('RegistryPassword', 'password');
        tr.setInput('ImageName', 'azurespringcloudtesting/byoc-it-springboot:v1');
        tr.setInput('ImageCommand', 'java');
        tr.setInput('ImageArgs', "-jar /app.jar");
        tr.setInput('ImageLanguageFramework', 'springboot');
        tr.setInput('EnvironmentVariables', '-key1 val1 -key2 "val     2"');
        printTaskInputs();
    }

    public static mochaTest = (done: Mocha.Done) => {
        
        DeploymentCustomImageToStagingSucceeds.mockTaskInputParameters();
        let testPath = path.join(__dirname, 'DeploymentCustomImageToStagingSucceedsL0.js');
        let mockTestRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);
        try {
            mockTestRunner.run();
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