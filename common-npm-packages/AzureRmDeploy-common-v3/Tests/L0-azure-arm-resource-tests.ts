import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';

export function ResourcesTests() {
    it('azure-arm-resource Resources', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-resource-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;

        try {
            tr.run();
            assert(tr.stdOutContained('ResourcesTests - getResources : 1'), "Should have printed: ResourcesTests - getResources : 1");
        }
        catch(error) {
            passed = false;
            console.log(tr.stdout);
            console.log(tr.stderr);
            done(error);
        }

        if(passed) {
            done();
        }
    });
}