import * as assert from 'assert';
import path = require('path');
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

describe("Create Snapshot test", function () {
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

    it("Successfully create a snapshot", async () => {
        const taskPath = path.join(__dirname, "createSnapshot.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(() => {
            assert.strictEqual(tr.succeeded, true, "should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.strictEqual(tr.stdout.indexOf(`loc_mock_SnapshotCreatedSuccessfully`) >= 0, true, "should have printed snapshot created successfully");
        }, tr);
    });

    it("Handle create snapshot conflict request", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithConflict.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], `loc_mock_SnapshotAlreadyExists TestSnapshot Status code: 409`);
        }, tr);
    });

    it("Handle create snapshot forbidden request", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithForbidden.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_AccessDenied Status code: 403", "Should have error message");
        }, tr);
    });

    it("Handle empty filter", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithEmptyFilter.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should have failed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_MaxAndMinFiltersRequired");
        }, tr);
    });

    it("Handle invalid composition type", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithInvalidCompositionType.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should have failed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_InvalidCompositionTypeValue key key_label invalidCompositionType");
        }, tr);
    });

    it("Handle invalid filter type", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithInvalidFilter.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should have failed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_InvalidFilterFormat");
        }, tr);
    });

    it("Handle invalid json filters", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithInvalidJsonFilter.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should have failed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_InvalidFilterFormatJSONObjectExpected");
        }, tr);
    });

    it("Handle invalid key filter property", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithInvalidKeyFilter.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should have failed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_InvalidFilterFormatKeyIsRequired");
        }, tr);
    });

    it("Handle invalid label filter property", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithInvalidLabelFilter.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should have failed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0],`loc_mock_InvalidFilterFormatExpectedAllowedProperties {"key":"*","label_filter":"2.0.0"}`);
        }, tr);

        try {

        } catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            console.log("Error", error);
        }
    });

    it("Handle invalid retention period", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithInvalidRetention.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
    });

    it("Handle invalid tags", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithInvalidTags.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should have failed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_InvalidTagFormatValidJSONStringExpected");
        }, tr);
    });

    it("Handle invalid tag type", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithInvalidTagType.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should have failed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_InvalidTagFormatOnlyStringsSupported");
        }, tr);
    });

    it("Handle max filters", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithMaxFilters.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(() => {
            assert.strictEqual(tr.succeeded, false, "should have failed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_MaxAndMinFiltersRequired");
        }, tr);
    });

    it("Warn for minimum retention period", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithMinRetention.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(() => {
            assert.strictEqual(tr.succeeded, true, "should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 1, "should have one warning");
            assert.strictEqual(tr.errorIssues.length, 0, "should no error");
            assert.strictEqual(tr.warningIssues[0], "loc_mock_MinRetentionAfterArchiveSnapshot");
        }, tr);
    });

    it("Trim trailing forward slash in store endpoint", async () => {
        const taskPath = path.join(__dirname, "createSnapshotWithInvalidStoreEndpoint.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(() => {
            assert.strictEqual(tr.succeeded, true, "should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.ok(tr.stdout.indexOf("loc_mock_AzureAppConfigurationEndpointTitle https://Test.azconfig.io") >= 0, "App Configuration Endpoint: https://Test.azconfig.io");
        }, tr);
    });

});
