import * as path from 'path';
import assert = require('assert');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

export class SetDeploymentFailsWithInsufficientDeployments {
    public static mochaTest = (done: Mocha.Done) => {
      
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