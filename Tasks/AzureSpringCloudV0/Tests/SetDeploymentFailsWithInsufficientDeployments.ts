import * as path from 'path';
import assert = require('assert');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

export class SetDeploymentFailsWithInsufficientDeployments {
    public static mochaTest = (done: MochaDone) => {
      
        let tp = path.join(__dirname, 'SetDeploymentFailsWithInsufficientDeploymentsL0.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            console.log('Run completed');
            console.log('STDOUT: '+tr.stdout);
            console.error('STDERR: '+ tr.stderr);
            assert(tr.failed);
            let expectedError = 'No staging deployment found';
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.stdErrContained(expectedError) || tr.createdErrorIssue(expectedError), 'E should have said: ' + expectedError);
            done();
        }
        catch (error) {
            done(error);
        }
    };
}