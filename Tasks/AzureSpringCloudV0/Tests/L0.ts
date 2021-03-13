import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('Azure Spring Cloud deployment Suite', function () {
    this.timeout(60000);

    before(() => {
    });

    after(() => {
    });

    it('Correctly errors out when attempting set staging deployment as production and no staging deployment exists', (done: MochaDone) => {
            console.log('Running new test');
            let tp = path.join(__dirname,'SetDeploymentFailsWithInsufficientDeployment.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            try {
                tr.run();
                console.log('Run completed');
                console.log('STDOUT: ' + tr.stdout);
                console.log('STDERR: ' + tr.stderr);
                assert(tr.failed);
                console.error('Issues: '+tr.errorIssues.join(', '));
                let expectedError = 'No staging deployment found';
                assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.stdErrContained(expectedError) || tr.createdErrorIssue(expectedError), 'E should have said: ' + expectedError); 
                done();
                console.log('Called done!');
            }
            catch(error) {
                done(error);
            }
        });
});

