import * as assert from 'assert';
import path = require('path');
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

describe("Pull configuration settings test", function(){
    this.timeout(30000);

    before(async ()=> {
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenant";
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_AUTHENTICATIONTYPE"] = "spnKey";
        process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
        process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
        process.env["ENDPOINT_DATA_AzureRMSpn_GRAPHURL"] = "https://graph.windows.net/";
        process.env["ENDPOINT_DATA_AzureRMSpn_ENVIRONMENT"] = "AzureCloud";
        process.env["ENDPOINT_URL_AzureRMSpn"] = "https://management.azure.com/";
        process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "C:\\a\\w\\";
        process.env["AGENT_TEMPDIRECTORY"] = process.cwd();
    });

    function runValidations(validator: () => void, testRunner) {
        try {
            validator();
        } catch (error) {
            console.log("STDERR", testRunner.stderr);
            console.log("STDOUT", testRunner.stdout);
            console.log("Error", error);
        }
    }

    it("Successfully download key-values and key vault reference", async()=> {
        const taskPath = path.join(__dirname, "downloadKeyValues.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.ok(tr.stdout.indexOf("loc_mock_AppConfigurationEndpointTitle https://Test.azconfig.io") >= 0, "App Configuration Endpoint: https://Test.azconfig.io");
            assert.ok(tr.stdout.indexOf("loc_mock_RetrievedKeyValues 5") > 0, "'5' key-values were retrieved from Azure App Configuration.");
            // key value pairs expected 
            assert.ok(tr.stdout.indexOf("##vso[task.setvariable variable=Mvc:FontColor;isOutput=false;issecret=false;]orange") > 0, "##vso[task.setvariable variable=Mvc:FontColor;isOutput=false;issecret=false;]orange");
            assert.ok(tr.stdout.indexOf("##vso[task.setvariable variable=Mvc:BackGroundColor;isOutput=false;issecret=false;]white") > 0, "##vso[task.setvariable variable=Mvc:BackGroundColor;isOutput=false;issecret=false;]white");
            assert.ok(tr.stdout.indexOf("##vso[task.setvariable variable=Message;isOutput=false;issecret=false;]Test 1") > 0, "##vso[task.setvariable variable=Message;isOutput=false;issecret=false;]Test 1");
        },tr);
    });

    it("Successfully download key-values with key filter, default selection mode", async()=> {
        const taskPath = path.join(__dirname, "downloadKeyValuesWithFilter.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.ok(tr.stdout.indexOf("loc_mock_AppConfigurationEndpointTitle https://Test.azconfig.io") >= 0, "App Configuration Endpoint: https://Test.azconfig.io");
            assert.ok(tr.stdout.indexOf(" 'S*'") > 0, "'S*'");
        }, tr);
    });

    it("Successfully download key values from snapshot, snapshot selection mode", async()=> {
        const taskPath = path.join(__dirname, "downloadKeyValuesFromSnapshot.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.ok(tr.stdout.indexOf("loc_mock_AppConfigurationEndpointTitle https://Test.azconfig.io") >= 0, "App Configuration Endpoint: https://Test.azconfig.io");
            assert.ok(tr.stdout.indexOf(`loc_mock_RetrievedKeyValues 3`) > 0, "'3' key-values were retrieved from Azure App Configuration.");
            // key value pairs expected
            assert.ok(tr.stdout.indexOf("##vso[task.setvariable variable=Message;isOutput=false;issecret=false;]orange") > 0, "##vso[task.setvariable variable=Message;isOutput=false;issecret=false;]orange");
            assert.ok(tr.stdout.indexOf("##vso[task.setvariable variable=Mvc:BackGroundColor;isOutput=false;issecret=false;]white") > 0, "##vso[task.setvariable variable=Mvc:BackGroundColor;isOutput=false;issecret=false;]white");
        },tr);
    });

    it("Handle invalid selection mode", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithInvalidSelection.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "should not succeeded");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues[0], `loc_mock_SupportedOptionsForSelectionMode Default Snapshot`,"should print std out" );
        },tr);
    });

    it("Handle forbidden key vault request", async()=>{
        const taskPath = path.join(__dirname, "downloadKeyVaultRefWithForbidden.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "should not succeed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_AccessDeniedToUrl https://my-vault.vault.azure.net/secrets/TestMessage Status code: 403", "Should have error message");
        },tr);
    });

    it("Handle forbidden request",async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithForbidden.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "Should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_AccessDenied Status code: 403", "Should have error message");
        },tr);
    });

    it("Handle unauthorized request", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithUnauthorized.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "Should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_AuthenticationRestError 401 https://test.azconfig.io  HMAC 12345908");
        }, tr);
    });

    it("Handle multiline secrets present in key vault reference", async()=>{
        const taskPath = path.join(__dirname, "downloadSecretWithMultiline.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "should not succeed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_FailedToSetSecretVariable Settings:KeyVault:Message");
        }, tr);
    });

    it("Throw error when pull key-values from snapshot with composition type Key Label", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithInvalidCompositionType.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "Should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], `loc_mock_InvalidCompositionTypeValue key_label key`, "Should have error message");
        }, tr);
    });

    it("Handle a snapshot not found", async()=>{
        const taskPath = path.join(__dirname, "downloadKVSnapshotNotFound.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "Should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_SnapshotNotFound testSnapshot Status code: 404", "Should have error message");
        }, tr);
    });

    it("Successfully suppress warning for overridden key values", async()=>{
        const taskPath = path.join(__dirname, "downloadDuplicateKVSuppressWarning.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "Should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
        }, tr);
    });

    it("Treat key vault reference resolution error as a warning", async()=>{
        const taskPath = path.join(__dirname, "downloadKeyVaultRefSuppressWarning.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "should succeed");
            assert.strictEqual(tr.warningIssues.length, 1, "should have one warning");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.strictEqual(tr.warningIssues[0], "loc_mock_FailedToSetSecretVariable Settings:KeyVault:Message");
        }, tr);
    });

    it("Handle invalid app configuration endpoint", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithInvalidEndpoint.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0],"loc_mock_InvalidAppConfigurationEndpoint Test.azconfig.io");
        }, tr);
    });

    it("Warn when pulling key-values from an archived snapshot", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithArchivedSnapshot.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "Should succeeded");
            assert.strictEqual(tr.warningIssues.length, 1, "should have one warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.strictEqual(tr.warningIssues[0], `loc_mock_ArchivedSnapshotWarning testSnapshot ${new Date("2023-12-12")}`, "should have warning message");
        }, tr);
    });

    it("Warn when pulling key-values and duplicate key-values are present", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithDuplicateKey.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "Should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 1, "should have one warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.strictEqual(tr.warningIssues[0],'loc_mock_DuplicateKeysFound 1',"should have warning message")
        }, tr);
    });

    it("Throw for an invalid key vault secret url", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithInvalidSecretUrl.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "should not succeed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warning");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_InvalidSecretUrl");
        },tr);
    });
})