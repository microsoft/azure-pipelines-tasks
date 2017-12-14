import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
import * as path from 'path';


export function AzureAppServiceMockTests() {

    it('azure-arm-app-service AzureAppService start()', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-app-service-tests-start.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;
        
        try {
            tr.run();
            assert(tr.succeeded, "azure-arm-app-service-tests start() should have passed");
            
            assert(tr.stdOutContained('StartingAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StartingAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('StartedAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StartedAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('StartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'), 'Should have printed: StartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
            assert(tr.stdOutContained('Error: FailedToStartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)'),
                'Should have printed Error: FailedToStartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)');
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

    it('azure-arm-app-service AzureAppService stop()', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-app-service-tests-start.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;
        try {
            tr.run();
            assert(tr.succeeded, "azure-arm-app-service-tests start() should have passed");
            
            assert(tr.stdOutContained('StartingAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StartingAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('StartedAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StartedAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('StartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'), 'Should have printed: StartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
            assert(tr.stdOutContained('Error: FailedToStartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)'),
                'Should have printed Error: FailedToStartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)');
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

    it('azure-arm-app-service AzureAppService restart()', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-app-service-tests-restart.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;
        try {
            tr.run();
            assert(tr.succeeded, "azure-arm-app-service-tests start() should have passed");
            
            assert(tr.stdOutContained('RestartingAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: RestartingAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('RestartedAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: RestartedAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('RestartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'), 'Should have printed: RestartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
            assert(tr.stdOutContained('Error: FailedToRestartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)'),
                'Should have printed Error: FailedToRestartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)');
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


    it('azure-arm-app-service AzureAppService swap()', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-app-service-tests-swap.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;
        try {
            tr.run();
            assert(tr.succeeded, "azure-arm-app-service-tests swap() should have passed");
            
            assert(tr.stdOutContained('SwappingAppServiceSlotSlots MOCK_APP_SERVICE_NAME production MOCK_TARGET_SLOT'), 'Should have printed: SwappingAppServiceSlotSlots MOCK_APP_SERVICE_NAME production MOCK_TARGET_SLOT');
            assert(tr.stdOutContained('SwappedAppServiceSlotSlots MOCK_APP_SERVICE_NAME production MOCK_TARGET_SLOT'), 'Should have printed: SwappedAppServiceSlotSlots MOCK_APP_SERVICE_NAME production MOCK_TARGET_SLOT');
            assert(tr.stdOutContained('SwappingAppServiceSlotSlots MOCK_APP_SERVICE_NAME MOCK_SLOT_NAME MOCK_TARGET_SLOT'), 'Should have printed: SwappingAppServiceSlotSlots MOCK_APP_SERVICE_NAME MOCK_SLOT_NAME MOCK_TARGET_SLOT');
            assert(tr.stdOutContained('Error: FailedToSwapAppServiceSlotSlots MOCK_APP_SERVICE_NAME MOCK_SLOT_NAME MOCK_TARGET_SLOT one of the slots is in stopped state. (CODE: 409)'),
                'Should have printed: Error: FailedToSwapAppServiceSlotSlots MOCK_APP_SERVICE_NAME MOCK_SLOT_NAME MOCK_TARGET_SLOT one of the slots is in stopped state. (CODE: 409)');
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


/*
    it('azure-arm-app-service-tests', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-app-service-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        done();

        try {
            tr.run();
            assert(tr.succeeded, "azure-arm-app-service-tests should have passed");
            
            assert(tr.stdOutContained('StartingAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StartingAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('StartedAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StartedAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('StartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'), 'Should have printed: StartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
            assert(tr.stdOutContained('Error: FailedToStartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)'),
                'Should have printed Error: FailedToStartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)');
            
            
            assert(tr.stdOutContained('StoppingAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StoppingAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('StoppedAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: StoppedAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('StoppingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'), 'Should have printed: StoppingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'); 
            assert(tr.stdOutContained('Error: FailedToStopAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)'),
                'Should have printed Error: FailedToStopAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)');
            
            
            assert(tr.stdOutContained('RestartingAppService MOCK_APP_SERVICE_NAME'), 'RestartingAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('RestartedAppService MOCK_APP_SERVICE_NAME'), 'Should have printed: RestartedAppService MOCK_APP_SERVICE_NAME');
            assert(tr.stdOutContained('RestartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME'), 'Should have printed: RestartingAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME');
            assert(tr.stdOutContained('Error: FailedToRestartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)'),
                'Should have printed Error: FailedToRestartAppService MOCK_APP_SERVICE_NAME-MOCK_SLOT_NAME internal_server_error (CODE: 500)');
            
        }
        catch(error) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            done(error);
        }
    });
*/

}