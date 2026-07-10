import * as assert from 'assert';
import * as path from "path";
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

describe("Import task test", function () {
    this.timeout(30000);

    before(async () => {
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenant";
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_AUTHENTICATIONTYPE"] = "spnKey";
        process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
        process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] = "sId";
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

    it("Successfully push key-values", async () => {
        const taskPath = path.join(__dirname, "setKeyValues.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();

        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, true, "should have succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 0, "should have no errors");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.ok(testRunner.stdout.indexOf("loc_mock_SuccessfullyUploadedConfigurations 10") > 0, "should log successfully imported key-values");
        }, testRunner);
    });

    it("Handle conflict request when setting key-value", async () => {
        const taskPath = path.join(__dirname, "setKeyValueWithConflict.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();

        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, false, "should not succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 1, "should have one error");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(testRunner.errorIssues[0], "loc_mock_ConflictErrorMessage app:Settings:BackgroundColor Status code: 409")
        }, testRunner)
    });

    it("Handle forbidden request when setting key-value", async () => {
        const taskPath = path.join(__dirname, "setKeyValueWithForbiddenCredentials.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();
        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, false, "should not succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 1, "should have one error");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(testRunner.errorIssues[0], "loc_mock_AccessDeniedMessage Status code: 403", "Should have error message");
        }, testRunner)
    });

    it("Throw when invalid file format is provided, valid file format are Json, Yaml, Properties", async () => {
        const taskPath = path.join(__dirname, "setKeyValueWithInvalidFileFormat.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();
        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, false, "should not succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 1, "should have one error");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(testRunner.errorIssues[0], "loc_mock_FileFormatNotSupported txt json yaml properties","should print std out" );
            assert.ok(testRunner.stdout.indexOf("loc_mock_FileFormatNotSupported txt json yaml properties") > 0, "should print std out" );
        }, testRunner);
    });

    it("Handle unauthorized request when setting key-value", async () => {
        const taskPath = path.join(__dirname, "setKeyValueWithUnauthorizedCredentials.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();

        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, false, "should not succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 1, "should have one error");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(testRunner.errorIssues[0], "loc_mock_AuthenticationErrorRestError 401 https://test.azconfig.io  HMAC 12345908");
        }, testRunner);
    });

    it("Throw when invalid tags are provided", async () => {
        const taskPath = path.join(__dirname, "setKeyValueWithInvalidTag.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();

        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, false, "should not succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 1, "should have one error");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.ok(testRunner.stdout.indexOf(testRunner.errorIssues[0]) > 0, "should print to stdout");
            assert.strictEqual(testRunner.errorIssues[0], "loc_mock_InvalidTagFormat");
        }, testRunner);
    });

    it("Successfully set key-value from a text config file with file format specified as Json", async () => {
        const taskPath = path.join(__dirname, "setKeyValueFromTxtFile.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();
        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, true, "should have succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 0, "should have no errors");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.ok(testRunner.stdout.indexOf("loc_mock_SuccessfullyUploadedConfigurations 10") > 0, "should log successfully imported key-values");
        }, testRunner);
    });

    it("Throw when invalid file content profile is provided", async () => {
        const taskPath = path.join(__dirname, "setKeyValueWithInvalidContentProfile.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();
        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, false, "should not succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 1, "should have one error");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(testRunner.errorIssues[0], "loc_mock_SupportedOptionsForFileContentProfile appconfig/default appconfig/kvset", "should print std out");
        }, testRunner);
    });

    it("Throw when invalid file import mode is provided", async () => {
        const taskPath = path.join(__dirname, "setKeyValueWithInvalidImportMode.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();
        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, false, "should not succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 1, "should have one error");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(testRunner.errorIssues[0], "loc_mock_OnlySupportedImportModeOptions All Ignore-Match", "should print std out");
        }, testRunner);
    });

    it("Throw when unsupported options are provided for kvset content profile", async () => {
        const taskPath = path.join(__dirname, "setKeyValueWithUnsupportedKvSetOptions.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();
        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, false, "should not succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 1, "should have one error");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(testRunner.errorIssues[0], "loc_mock_UnsupportedOptionsForKVSetProfile appconfig/kvset", "should print std out");
        }, testRunner);
    });

    it("Throw when invalid store endpoint is provided", async () => {
        const taskPath = path.join(__dirname, "setKeyValueWithInvalidStoreEndpoint.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();
        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, false, "should not succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 1, "should have one error");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(testRunner.errorIssues[0], "loc_mock_InvalidAppConfigurationEndpoint Test");
        }, testRunner);
    });

    it("Throw when invalid tags are provided", async () => {
        const taskPath = path.join(__dirname, "setKeyValueWithInvalidTagType.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();

        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, false, "should not succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 1, "should have one error");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(testRunner.errorIssues[0], "loc_mock_InvalidTypeInTags");
        }, testRunner);
    });

    it("Trim any trailing forward slash in store endpoint", async ()=> {
        const taskPath = path.join(__dirname, "setKeyValueWithInvalidEndpoint.js");
        const testRunner = new MockTestRunner(taskPath);

        await testRunner.runAsync();

        runValidations(() => {
            assert.strictEqual(testRunner.succeeded, true, "should have succeeded");
            assert.strictEqual(testRunner.errorIssues.length, 0, "should have no errors");
            assert.strictEqual(testRunner.warningIssues.length, 0, "should have no warnings");
            assert.ok(testRunner.stdout.indexOf("loc_mock_AppConfigurationEndpointTitle https://Test.azconfig.io") > 0, "should successfully trim any trailing forward slash");
        }, testRunner);
    })
});