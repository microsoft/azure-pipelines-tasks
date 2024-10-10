import assert = require("assert");
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';

export function ResourcesTests(defaultTimeout = 2000) {
    it('azure-arm-resource Resources', function (done: Mocha.Done) {
        this.timeout(defaultTimeout);
        let tp = path.join(__dirname, 'azure-arm-resource-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;

        tr.runAsync()
        .then(() => {
            assert(tr.stdOutContained('ResourcesTests - getResources : 1'), "Should have printed: ResourcesTests - getResources : 1");
            done();
        })
        .catch((error) => {
            passed = false;
            console.log(tr.stdout);
            console.log(tr.stderr);
            done(error);
        });
    });
}