import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';

export function ApplicationInsightsTests() {
    it('azure-arm-appinsights AzureApplicationInsights', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-appinsights-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;
        try {
            tr.run();
            assert(tr.succeeded, "azure-arm-appinsights should have passed but failed.");
            console.log("\tvalidating get");
            get(tr);
            console.log("\tvalidating update");
            update(tr);
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

function get(tr) {
    assert(tr.stdOutContained('GET APP INSIGHTS RESOURCE ID MOCKED: subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME'),
        'Should have printed: GET APP INSIGHTS RESOURCE ID MOCKED: subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME');
    assert(tr.stdOutContained('FailedToGetApplicationInsightsResource FAIL_MOCK_APP_INSIGHTS_NAME Internal Server error occured. (CODE: 501)'),
        'Should have printed: FailedToGetApplicationInsightsResource FAIL_MOCK_APP_INSIGHTS_NAME Internal Server error occured. (CODE: 501)');
}

function update(tr) {
    assert(tr.stdOutContained('UPDATE APP INSIGHTS RESOURCE ID MOCKED: subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME'),
        'Should have printed: UPDATE APP INSIGHTS RESOURCE ID MOCKED: subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME');
    assert(tr.stdOutContained('FailedToUpdateApplicationInsightsResource FAIL_MOCK_APP_INSIGHTS_NAME Internal Server error occured. (CODE: 501)'),
        'Should have printed: FailedToUpdateApplicationInsightsResource FAIL_MOCK_APP_INSIGHTS_NAME Internal Server error occured. (CODE: 501)');
}