import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib/task');
import * as path from 'path';

export function AzureAppServiceMockTests() {
    it('azure-arm-app-service AzureAppService', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-app-service-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;
        try {
            tr.run();
            assert(tr.succeeded, "azure-arm-app-service-tests should have passed but failed.");
            console.log("\tvalidating start");
            start(tr);
            console.log("\tvalidating stop");
            stop(tr);
            console.log("\tvalidating restart");
            restart(tr);
            console.log("\tvalidating swap");
            swap(tr);
            console.log("\tvalidating get");
            get(tr);
            console.log("\tvalidating getPublishingProfileWithSecrets");
            getPublishingProfileWithSecrets(tr);
            console.log("\tvalidating getPublishingCredentials");
            getPublishingCredentials(tr);
            console.log("\tvalidating getApplicationSettings");
            getApplicationSettings(tr);
            console.log("\tvalidating updateApplicationSettings");
            updateApplicationSettings(tr);
            console.log("\tvalidating getConfiguration");
            getConfiguration(tr);
            console.log("\tvalidating updateConfiguration");
            updateConfiguration(tr);
            console.log("\tvalidating patchConfiguration");
            patchConfiguration(tr);
            console.log("\tvalidating getMetadata");
            getMetadata(tr);
            console.log("\tvalidating updateMetadata");
            updateMetadata(tr);
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

function start(tr) {
    assert(tr.stdOutContained('StartingAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StartingAppService MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained('StartedAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StartedAppService MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained('StartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'), 'Should have printed: StartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
    assert(tr.stdOutContained('Error: FailedToStartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'),
        'Should have printed Error: FailedToStartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function stop(tr) {
    assert(tr.stdOutContained('StoppingAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StoppingAppService MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained('StoppedAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StoppedAppService MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained('StoppingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'), 'Should have printed: StoppingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
    assert(tr.stdOutContained('Error: FailedToStopAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'),
        'Should have printed Error: FailedToStopAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function restart(tr) {
    assert(tr.stdOutContained('RestartingAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: RestartingAppService MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained('RestartedAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: RestartedAppService MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained('RestartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'), 'Should have printed: RestartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
    assert(tr.stdOutContained('Error: FailedToRestartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'),
        'Should have printed Error: FailedToRestartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function swap(tr) {
    assert(tr.stdOutContained('SwappingAppServiceSlotSlots MOCK_APP_SERVICE_NAME production MOCK_TARGET_SLOT'), 'Should have printed: SwappingAppServiceSlotSlots MOCK_APP_SERVICE_NAME production MOCK_TARGET_SLOT');
    assert(tr.stdOutContained('SwappedAppServiceSlotSlots MOCK_APP_SERVICE_NAME production MOCK_TARGET_SLOT'), 'Should have printed: SwappedAppServiceSlotSlots MOCK_APP_SERVICE_NAME production MOCK_TARGET_SLOT');
    assert(tr.stdOutContained('SwappingAppServiceSlotSlots MOCK_APP_SERVICE_NAME MOCK_SLOT_NAME MOCK_TARGET_SLOT'), 'Should have printed: SwappingAppServiceSlotSlots MOCK_APP_SERVICE_NAME MOCK_SLOT_NAME MOCK_TARGET_SLOT');
    assert(tr.stdOutContained('Error: FailedToSwapAppServiceSlotSlots MOCK_APP_SERVICE_NAME MOCK_SLOT_NAME MOCK_TARGET_SLOT one of the slots is in stopped state. (CODE: 501)'),
        'Should have printed: Error: FailedToSwapAppServiceSlotSlots MOCK_APP_SERVICE_NAME MOCK_SLOT_NAME MOCK_TARGET_SLOT one of the slots is in stopped state. (CODE: 501)');
}

function get(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME'),
        'Should have printed: MOCK_APP_SERVICE_NAME ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained('Error: FailedToGetAppServiceDetails MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'),
        'Should have printed: Error: FailedToGetAppServiceDetails MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function monitorAppState(tr) {
    assert(tr.stdOutContained('App Service state: Running'), 'Should have printed: App Service state: Running');
    assert(tr.stdOutContained("App Service state 'Running' matched with expected state 'running'."), "Should have printed: App Service state 'Running' matched with expected state 'running'.");
}

function getPublishingProfileWithSecrets(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME.scm.azurewebsites.net:443'), 'Should have printed: MOCK_APP_SERVICE_NAME.scm.azurewebsites.net:443');
    assert(tr.stdOutContained('Error: FailedToGetAppServicePublishingProfile MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
    'Should have printed: Error: FailedToGetAppServicePublishingProfile MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function getPublishingCredentials(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME PUBLISHINGCREDENTIALS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/publishingcredentials/$MOCK_APP_SERVICE_NAME'),
        'Should have printed: MOCK_APP_SERVICE_NAME PUBLISHINGCREDENTIALS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/publishingcredentials/$MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained('Error: FailedToGetAppServicePublishingCredentials MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed: Error: FailedToGetAppServicePublishingCredentials MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function getApplicationSettings(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME APPSETTINGS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings'),
        'Should have printed: MOCK_APP_SERVICE_NAME APPSETTINGS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings');
    assert(tr.stdOutContained('Error: FailedToGetAppServiceApplicationSettings MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed: Error: FailedToGetAppServiceApplicationSettings MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function updateApplicationSettings(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME APPSETTINGS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings'),
        'Should have printed: MOCK_APP_SERVICE_NAME APPSETTINGS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings');
    assert(tr.stdOutContained('Error: FailedToUpdateAppServiceApplicationSettings MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed: Error: FailedToUpdateAppServiceApplicationSettings MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function getConfiguration(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME CONFIG_WEB ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web'),
        'Should have printed: MOCK_APP_SERVICE_NAME CONFIG_WEB ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web');
    assert(tr.stdOutContained('Error: FailedToUpdateAppServiceApplicationSettings MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed: Error: FailedToUpdateAppServiceApplicationSettings MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function updateConfiguration(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME CONFIG_WEB ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web'),
        'Should have printed: MOCK_APP_SERVICE_NAME CONFIG_WEB ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web');
    assert(tr.stdOutContained('Error: FailedToUpdateAppServiceConfiguration MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed: Error: FailedToUpdateAppServiceConfiguration MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function patchConfiguration(tr) {
    assert(tr.stdOutContained('PATCH CONFIGURATION PASSED'), 'Should have printed: PATCH CONFIGURATION PASSED');
    assert(tr.stdOutContained(' FailedToPatchAppServiceConfiguration MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed: FailedToPatchAppServiceConfiguration MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function getMetadata(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME CONFIG_METADATA GET ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/metadata'),
        'Should have printed: MOCK_APP_SERVICE_NAME CONFIG_METADATA GET ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/metadata');
    assert(tr.stdOutContained(' FailedToGetAppServiceMetadata MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed:  FailedToGetAppServiceMetadata MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function updateMetadata(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME CONFIG_METADATA UPDATE ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/metadata'),
        'Should have printed: MOCK_APP_SERVICE_NAME CONFIG_METADATA UPDATE ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/metadata');
    assert(tr.stdOutContained(' FailedToUpdateAppServiceMetadata MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed: FailedToUpdateAppServiceMetadata MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}
