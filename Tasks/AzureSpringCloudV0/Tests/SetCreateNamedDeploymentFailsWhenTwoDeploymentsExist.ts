import * as path from 'path';
import assert = require('assert');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

export class SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist {
    public static mochaTest = (done: Mocha.Done) => {
      
        let taskPath = path.join(__dirname, 'SetCreateNamedDeploymentFailsWhenTwoDeploymentsExistL0.js');
        let mockTestRunner: ttm.MockTestRunner = new ttm.MockTestRunner(taskPath);
        try {
            mockTestRunner.run();
            console.log('Run completed');
            console.log('STDOUT: '+mockTestRunner.stdout);
            console.error('STDERR: '+ mockTestRunner.stderr);
            assert(mockTestRunner.failed);
            let expectedError = 'Two deployments already exist';
            assert(mockTestRunner.errorIssues.length > 0 || mockTestRunner.stderr.length > 0, 'should have written to stderr');
            assert(mockTestRunner.stdErrContained(expectedError) || mockTestRunner.createdErrorIssue(expectedError), 'E should have said: ' + expectedError);
            done();
        }
        catch (error) {
            done(error);
        }
    };
}