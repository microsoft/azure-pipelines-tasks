import assert = require("assert");
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';

export function AksServiceTests() {
    it('azure-arm-aks-service AksService', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'azure-arm-aks-service-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;

        tr.runAsync().then(() => {
            assert(tr.stdOutContained("Aks Cluster Credential Found: clusterAdmin"), "Should have printed: Aks Cluster Credential Found: clusterAdmin");
            assert(tr.stdOutContained("Aks Cluster Credential Found: clusterUser"), "Should have printed: Aks Cluster Credential Found: clusterUser");
            assert(tr.stdOutContained("Aks Cluster Credential Found: customUser"), "Should have printed: Aks Cluster Credential Found: customUser");
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