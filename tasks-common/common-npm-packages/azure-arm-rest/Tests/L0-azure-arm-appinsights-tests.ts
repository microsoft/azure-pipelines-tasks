import assert = require("assert");
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';

export function ApplicationInsightsTests(defaultTimeout = 6000) {
    it('azure-arm-appinsights AzureApplicationInsights', function (done: Mocha.Done) {
        this.timeout(defaultTimeout);
        let tp = path.join(__dirname, 'azure-arm-appinsights-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;

        tr.runAsync()
        .then(() => {
            assert(tr.succeeded, "azure-arm-appinsights should have passed but failed.");
            console.log("\tvalidating get");
            get(tr);
            console.log("\tvalidating update");
            update(tr);
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

function get(tr) {
    assert(tr.stdOutContained('GET APP INSIGHTS RESOURCE ID MOCKED: subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME'),
        'Should have printed: GET APP INSIGHTS RESOURCE ID MOCKED: subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME');
    assert(tr.stdOutContained("Failed to get Application Insights 'FAIL_MOCK_APP_INSIGHTS_NAME' Resource. Error: Internal Server error occured. (CODE: 501)"),
        'Should have printed: Failed to get Application Insights FAIL_MOCK_APP_INSIGHTS_NAME Resource. Error: Internal Server error occured. (CODE: 501)');
}

function update(tr) {
    assert(tr.stdOutContained('UPDATE APP INSIGHTS RESOURCE ID MOCKED: subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME'),
        'Should have printed: UPDATE APP INSIGHTS RESOURCE ID MOCKED: subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME');
    assert(tr.stdOutContained("Failed to update Application Insights 'FAIL_MOCK_APP_INSIGHTS_NAME' Resource. Error: Internal Server error occured. (CODE: 501)"),
        'Should have printed: Failed to update Application Insights FAIL_MOCK_APP_INSIGHTS_NAME Resource. Error: Internal Server error occured. (CODE: 501)');
}