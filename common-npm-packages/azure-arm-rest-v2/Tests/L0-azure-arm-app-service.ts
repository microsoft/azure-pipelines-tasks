import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib/task');
import * as path from 'path';

export function AzureAppServiceMockTests() {
    it('azure-arm-app-service AzureAppService', (done: Mocha.Done) => {
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
            console.log("\tvalidating delete");
            slotdelete(tr);
            console.log("\tvalidating swap");
            swap(tr);
            console.log("\tvalidating swapSlotWithPreview");
            swapSlotWithPreview(tr);
            console.log("\tvalidating cancelSwapSlotWithPreview");
            cancelSwapSlotWithPreview(tr);
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
    assert(tr.stdOutContained("Starting App Service: MOCK_APP_SERVICE_NAME"), 'Should have printed: Starting App Service: MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained("App Service 'MOCK_APP_SERVICE_NAME' started successfully."), 'Should have printed: App Service MOCK_APP_SERVICE_NAME started successfully');
    assert(tr.stdOutContained("Starting App Service: MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME"), 'Should have printed: Starting App Service: MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
    assert(tr.stdOutContained("Error: Failed to start App Service 'MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'. Error: internal error occurred (CODE: 501)"),
        'Should have printed Error: Failed to start App Service MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME. Error: internal error occurred (CODE: 501)');
}

function stop(tr) {
    assert(tr.stdOutContained("Stopping App Service: MOCK_APP_SERVICE_NAME"), 'Should have printed: Stopping App Service: MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained("App Service 'MOCK_APP_SERVICE_NAME' stopped successfully."), 'Should have printed: App Service MOCK_APP_SERVICE_NAME stopped successfully.');
    assert(tr.stdOutContained("Stopping App Service: MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME"), 'Should have printed: Stopping App Service: MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
    assert(tr.stdOutContained("Error: Failed to stop App Service 'MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'. Error: internal error occurred (CODE: 501)"),
        'Should have printed Error: Failed to stop App Service MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME. Error: internal error occurred (CODE: 501)');
}

function restart(tr) {
    assert(tr.stdOutContained("Restarting App Service: MOCK_APP_SERVICE_NAME"), 'Should have printed: Restarting App Service: MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained("App Service 'MOCK_APP_SERVICE_NAME' restarted successfully."), 'Should have printed: App Service MOCK_APP_SERVICE_NAME restarted successfully');
    assert(tr.stdOutContained("Restarting App Service: MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME"), 'Should have printed: Restarting App Service: MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
    assert(tr.stdOutContained("Error: Failed to restart App Service 'MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'. Error: internal error occurred (CODE: 501)"),
        'Should have printed Error: Failed to restart App Service MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME. Error: internal error occurred (CODE: 501)');
}

function slotdelete(tr) {
    assert(tr.stdOutContained("Deleting App Service slot: MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME"), 'Should have printed: Deleting App Service slot: MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
    assert(tr.stdOutContained("Deleting App Service slot: MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME"), 'Should have printed: Deleting App Service slot: MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
}

function swap(tr) {
    assert(tr.stdOutContained("Swapping App Service 'MOCK_APP_SERVICE_NAME' slots - 'production' and 'MOCK_TARGET_SLOT'"), 'Should have printed: Swapping App Service MOCK_APP_SERVICE_NAME slots - production and MOCK_TARGET_SLOT');
    assert(tr.stdOutContained("Swapped App Service 'MOCK_APP_SERVICE_NAME' slots - 'production' and 'MOCK_TARGET_SLOT'"), 'Should have printed: Swapped App Service MOCK_APP_SERVICE_NAME slots - production and MOCK_TARGET_SLOT');
    assert(tr.stdOutContained("Swapping App Service 'MOCK_APP_SERVICE_NAME' slots - 'MOCK_SLOT_NAME' and 'MOCK_TARGET_SLOT'"), 'Should have printed: Swapping App Service MOCK_APP_SERVICE_NAME slots - MOCK_SLOT_NAME and MOCK_TARGET_SLOT');
    assert(tr.stdOutContained("Error: Failed to swap App Service 'MOCK_APP_SERVICE_NAME' slots - 'MOCK_SLOT_NAME' and 'MOCK_TARGET_SLOT'. Error: one of the slots is in stopped state. (CODE: 501)"),
        'Should have printed: Error: Failed to swap App Service MOCK_APP_SERVICE_NAME slots - MOCK_SLOT_NAME and MOCK_TARGET_SLOT. Error: one of the slots is in stopped state. (CODE: 501)');
}

function swapSlotWithPreview(tr) {
    assert(tr.stdOutContained("Swapping Phase 1 Configuration Changes for App Service 'MOCK_APP_SERVICE_NAME' slots - 'production' and 'MOCK_TARGET_SLOT'"), 'Should have printed: Swapping Phase 1 Configuration Changes for App Service MOCK_APP_SERVICE_NAME slots - production and MOCK_TARGET_SLOT');
    assert(tr.stdOutContained("Swapped Phase 1 Configuration Changes for App Service 'MOCK_APP_SERVICE_NAME' slots - 'production' and 'MOCK_TARGET_SLOT'"), 'Should have printed: Swapped Phase 1 Configuration Changes for App Service MOCK_APP_SERVICE_NAME slots - production and MOCK_TARGET_SLOT');
    assert(tr.stdOutContained("Swapping Phase 1 Configuration Changes for App Service 'MOCK_APP_SERVICE_NAME' slots - 'MOCK_SLOT_NAME' and 'MOCK_TARGET_SLOT'"), 'Should have printed: Swapping Phase 1 Configuration Changes for App Service MOCK_APP_SERVICE_NAME slots - MOCK_SLOT_NAME and MOCK_TARGET_SLOT');
    assert(tr.stdOutContained("Error: Failed to swap Phase 1 configuration changes for App Service 'MOCK_APP_SERVICE_NAME' slots - 'MOCK_SLOT_NAME' and 'MOCK_TARGET_SLOT'. Error: one of the slots is in stopped state. (CODE: 501)"),
       'Should have printed: Error: Failed to swap Phase 1 configuration changes for App Service MOCK_APP_SERVICE_NAME slots - MOCK_SLOT_NAME and MOCK_TARGET_SLOT. Error: one of the slots is in stopped state. (CODE: 501)');
}

function cancelSwapSlotWithPreview(tr) {
    assert(tr.stdOutContained("Cancel Swap Phase 1 Configuration Changes for App Service 'MOCK_APP_SERVICE_NAME' slots - 'production'"), 'Should have printed: Cancel Swap Phase 1 Configuration Changes for App Service MOCK_APP_SERVICE_NAME slots - production');
    assert(tr.stdOutContained("Cancel Swap Phase 1 Configuration Changes for App Service 'MOCK_APP_SERVICE_NAME' slots - 'MOCK_SLOT_NAME'"), 'Should have printed: Cancel Swap Phase 1 Configuration Changes for App Service MOCK_APP_SERVICE_NAME slots - MOCK_SLOT_NAME');
    assert(tr.stdOutContained("Error: Failed to cancel swap Phase 1 configuration changes for App Service 'MOCK_APP_SERVICE_NAME' slot -'MOCK_SLOT_NAME'. Error: slot is in stopped state. (CODE: 501)"),
        'Should have printed: Error: Failed to cancel swap Phase 1 configuration changes for App Service MOCK_APP_SERVICE_NAME slot -MOCK_SLOT_NAME. Error: slot is in stopped state. (CODE: 501)');
}

function get(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME'),
        'Should have printed: MOCK_APP_SERVICE_NAME ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained("Error: Failed to fetch App Service 'MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME' details. Error: internal error occurred (CODE: 501)"),
        'Should have printed: Error: Failed to fetch App Service MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME details. Error: internal error occurred (CODE: 501)');
}

function monitorAppState(tr) {
    assert(tr.stdOutContained('App Service state: Running'), 'Should have printed: App Service state: Running');
    assert(tr.stdOutContained("App Service state 'Running' matched with expected state 'running'."), "Should have printed: App Service state 'Running' matched with expected state 'running'.");
}

function getPublishingProfileWithSecrets(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME.scm.azurewebsites.net:443'), 'Should have printed: MOCK_APP_SERVICE_NAME.scm.azurewebsites.net:443');
    assert(tr.stdOutContained("Error: Failed to fetch App Service 'MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME' publishing profile. Error: internal error occurred (CODE: 501)"), 
    'Should have printed: Error: Failed to fetch App Service MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME publishing profile. Error: internal error occurred (CODE: 501)');
}

function getPublishingCredentials(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME PUBLISHINGCREDENTIALS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/publishingcredentials/$MOCK_APP_SERVICE_NAME'),
        'Should have printed: MOCK_APP_SERVICE_NAME PUBLISHINGCREDENTIALS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/publishingcredentials/$MOCK_APP_SERVICE_NAME');
    assert(tr.stdOutContained("Error: Failed to fetch App Service 'MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME' publishing credentials. Error: internal error occurred (CODE: 501)"), 
        'Should have printed: Error: Failed to fetch App Service MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME publishing credentials. Error: internal error occurred (CODE: 501)');
}

function getApplicationSettings(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME APPSETTINGS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings'),
        'Should have printed: MOCK_APP_SERVICE_NAME APPSETTINGS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings');
    assert(tr.stdOutContained("Error: Failed to get App service 'MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME' application settings. Error: internal error occurred (CODE: 501)"), 
        'Should have printed: Error: Failed to get App service MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME application settings. Error: internal error occurred (CODE: 501)');
}

function updateApplicationSettings(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME APPSETTINGS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings'),
        'Should have printed: MOCK_APP_SERVICE_NAME APPSETTINGS ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings');
    assert(tr.stdOutContained("Error: Failed to update App service 'MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME' application settings. Error: internal error occurred (CODE: 501)"), 
        'Should have printed: Error: Failed to update App service MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME application settings. Error: internal error occurred (CODE: 501)');
}

function getConfiguration(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME CONFIG_WEB ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web'),
        'Should have printed: MOCK_APP_SERVICE_NAME CONFIG_WEB ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web');
    assert(tr.stdOutContained("Error: Failed to update App service 'MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME' application settings. Error: internal error occurred (CODE: 501)"), 
        'Should have printed: Error: Failed to update App service MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME application settings. Error: internal error occurred (CODE: 501)');
}

function updateConfiguration(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME CONFIG_WEB ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web'),
        'Should have printed: MOCK_APP_SERVICE_NAME CONFIG_WEB ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web');
    assert(tr.stdOutContained("Error: Failed to update App service 'MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME' configuration. Error: internal error occurred (CODE: 501)"), 
        'Should have printed: Error: Failed to update App service MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME configuration. Error: internal error occurred (CODE: 501)');
}

function patchConfiguration(tr) {
    assert(tr.stdOutContained('PATCH CONFIGURATION PASSED'), 'Should have printed: PATCH CONFIGURATION PASSED');
    assert(tr.stdOutContained('Error: FailedToPatchAppServiceConfiguration MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed: Error: FailedToPatchAppServiceConfiguration MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function getMetadata(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME CONFIG_METADATA GET ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/metadata'),
        'Should have printed: MOCK_APP_SERVICE_NAME CONFIG_METADATA GET ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/metadata');
    assert(tr.stdOutContained('Error: FailedToGetAppServiceMetadata MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed: Error: FailedToGetAppServiceMetadata MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}

function updateMetadata(tr) {
    assert(tr.stdOutContained('MOCK_APP_SERVICE_NAME CONFIG_METADATA UPDATE ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/metadata'),
        'Should have printed: MOCK_APP_SERVICE_NAME CONFIG_METADATA UPDATE ID: /subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/metadata');
    assert(tr.stdOutContained('Error: FailedToUpdateAppServiceMetadata MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)'), 
        'Should have printed: Error: FailedToUpdateAppServiceMetadata MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal error occurred (CODE: 501)');
}
