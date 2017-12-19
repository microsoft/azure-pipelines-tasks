import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
import * as path from 'path';

export function ApplicationInsightsTests() {
    it('azure-arm-appinsights-webtests ApplicationInsightsWebTests', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-appinsights-webtests-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;
        try {
            tr.run();
            assert(tr.succeeded, "azure-arm-appinsights-tests should have passed but failed.");
            console.log("validating list");
            list(tr);
            console.log("validating create");
            create(tr);
            console.log("validating addWebTest");
            addWebTest(tr);
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

function list(tr) {
    assert(tr.stdOutContained('retrieved list of tests for MOCK_RESOURCE_GROUP_NAME.'), 'Should have printed: retrieved list of tests for MOCK_RESOURCE_GROUP_NAME.');
    assert(tr.stdOutContained('WEB TEST COUNT: 2'), 'Should have printed: WEB TEST COUNT: 2');
}

function create(tr) {
    assert(tr.stdOutContained('FailedToCreateWebTests'), 'Should have printed: FailedToCreateWebTests');
    assert(tr.stdOutContained('added web test MOCK_TEST_1.'), 'added web test MOCK_TEST_1.');
}

function addWebTest(tr) {
    assert(tr.stdOutContained('WebTestAlreadyConfigured http://MOCK_APP_1.azurewebsites.net'), 'Should have printed: WebTestAlreadyConfigured http://MOCK_APP_1.azurewebsites.net');
}