import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('Azure Spring Cloud deployment Suite', function () {
    before(() => {
        console.log('Running before.');
    });

    after(() => {
    });

    it('Does a basic hello world test', function(done: MochaDone) {
        // TODO - add real tests
        done();
    });
    it('Correctly errors out on Set Deployments when not enough deployments present', (done: MochaDone) => {
            console.log('Running new test');
            let tp = path.join(__dirname,'SetDeploymentFailsWithInsufficientDeployment.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            try {
                tr.run();
                console.log('Run completed');
                console.log('STDOUT: ' + tr.stdout);
                console.log('STDERR: ' + tr.stderr);
                assert(tr.stdOutContained('Resource Group: MOCK_RESOURCE_GROUP_NAME'), 'Should have printed: Resource Group: MOCK_RESOURCE_GROUP_NAME');
                assert(tr.stdOutContained('PreDeployment steps with slot enabled should succeeded'), 'Should have printed: PreDeployment steps withSlotEnabled should succeeded');
                assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
                assert(tr.stdOutContained('PreDeployment steps with virtual application should succeeded'), 'Should have printed: PreDeployment steps with slot enabled should succeeded');
                done();
            }
            catch(error) {
                done(error);
            }
        });
});

