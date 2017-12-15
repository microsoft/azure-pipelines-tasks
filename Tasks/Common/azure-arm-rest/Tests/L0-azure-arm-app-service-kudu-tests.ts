import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import * as path from 'path';

export function KuduServiceTests() {
    it('azure-arm-app-service-kudu Kudu', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-app-service-kudu-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;
        try {
            tr.run();
            console.log(tr.stdout);
            console.log(tr.stderr);
            assert(tr.succeeded, "azure-arm-app-service-kudu-tests should have passed but failed.");
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

function updateDeployment(tr) {
    
}
