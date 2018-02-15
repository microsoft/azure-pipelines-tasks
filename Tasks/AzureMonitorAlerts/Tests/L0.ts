import * as path from "path";
import * as assert from "assert";
import { MockTestRunner } from "vsts-task-lib/mock-test";

describe("AzureMonitorAlerts Suite", () => {
    it("successfully creates alert rules when alert rules are not already present in resource group", (done: MochaDone) => {
    	let tmr : MockTestRunner = new MockTestRunner(path.join(__dirname, "L0AddAlertsSuccess.js"));
        tmr.run();

        assert(tmr.stderr.length == 0 && tmr.errorIssues.length == 0, "should not have written to stderr");
        let expectedOutput = "loc_mock_CreatedRule Rule1";
        assert(tmr.stdOutContained(expectedOutput), "should have logged proper message");
        expectedOutput = "loc_mock_CreatedRule Rule2";
        assert(tmr.stdOutContained(expectedOutput), "should have logged proper message");
        assert(tmr.succeeded, "task should have succeeded");
    	done();
    });

    it("successfully updates alert rules when alert rules are present in resource group", (done: MochaDone) => {
    	let tmr : MockTestRunner = new MockTestRunner(path.join(__dirname, "L0UpdateAlertsSuccess.js"));
        tmr.run();

        assert(tmr.stderr.length == 0 && tmr.errorIssues.length == 0, "should not have written to stderr");
        let expectedOutput = "loc_mock_UpdatedRule Rule1";
        assert(tmr.stdOutContained(expectedOutput), "should have logged proper message");
        expectedOutput = "loc_mock_UpdatedRule Rule2";
        assert(tmr.stdOutContained(expectedOutput), "should have logged proper message");
        assert(tmr.succeeded, "task should have succeeded");
    	done();
    });

    it("fails if alert rule name is configured for some other resource", (done: MochaDone) => {
    	let tmr : MockTestRunner = new MockTestRunner(path.join(__dirname, "L0AlertRuleNameConflictFail.js"));
        tmr.run();

        assert(tmr.stderr.length > 0 || tmr.errorIssues.length > 0, "should have written to stderr");
        let expectedError = "loc_mock_AlertRuleTargetResourceIdMismatchError Rule1 /subscriptions/sId/resourceGroups/testRg/providers/testResource.provider/type/testResourceName2";
        assert(tmr.stdErrContained(expectedError) || tmr.createdErrorIssue(expectedError), "should have thrown proper error message");
        assert(tmr.failed, "task should have failed");
    	done();
    });

    it("fails if not able to fetch target resource details", (done: MochaDone) => {
    	let tmr : MockTestRunner = new MockTestRunner(path.join(__dirname, "L0AlertRuleGetResourceFail.js"));
        tmr.run();

        assert(tmr.stderr.length > 0 || tmr.errorIssues.length > 0, "should have written to stderr");
        let expectedError = "Error: Failed request: (504)";
        assert(tmr.stdErrContained(expectedError) || tmr.createdErrorIssue(expectedError), "should have thrown proper error message");
        assert(tmr.failed, "task should have failed");
    	done();
    });

    it("successfully updates rules with email notifications", (done: MochaDone) => {
    	let tmr : MockTestRunner = new MockTestRunner(path.join(__dirname, "L0AlertRuleWithEmailSuccess.js"));
        tmr.run();

		assert(tmr.stderr.length == 0 && tmr.errorIssues.length == 0, "should not have written to stderr");
        assert(tmr.succeeded, "task should have succeeded");
    	done();
    });

    it("fails if PUT request to add alert rule fails", (done: MochaDone) => {
    	let tmr : MockTestRunner = new MockTestRunner(path.join(__dirname, "L0AddAlertRuleFails.js"));
        tmr.run();

		assert(tmr.stderr.length > 0 || tmr.errorIssues.length > 0, "should have written to stderr");
        let expectedError = "Error: Failed request: (504)";
        assert(tmr.stdErrContained(expectedError) || tmr.createdErrorIssue(expectedError), "should have thrown proper error message");
        assert(tmr.failed, "task should have failed");
    	done();
    });

    it("successfully fetches access token", (done: MochaDone) => {
    	let tmr : MockTestRunner = new MockTestRunner(path.join(__dirname, "L0AccessTokenFetchSuccess.js"));
        tmr.run();

		assert(tmr.stderr.length === 0 && tmr.errorIssues.length === 0, "should not have written to stderr");
        assert((tmr.stdout.match(/Requesting for Auth Token: https:\/\/login.windows.net\/tenantId\/oauth2\/token\//g) || []).length === 3, "should have made network call to fetch access token thrice");
        assert((tmr.stdout.match(/Returning authorization token from cache/g) || []).length === 1, "should have returned access token from cache once");
    	done();
    });

    it("fails if task is not able to fetch access token", (done: MochaDone) => {
        let tmr : MockTestRunner = new MockTestRunner(path.join(__dirname, "L0AccessTokenFetchFailure.js"));
        tmr.run();

        assert(tmr.stderr.length > 0 || tmr.errorIssues.length > 0, "should have written to stderr");
        let expectedError = "loc_mock_Couldnotfetchaccesstoken 401  loc_mock_SPNExpiredCheck";
        assert(tmr.stdErrContained(expectedError) || tmr.createdErrorIssue(expectedError), "should have thrown proper error message")
        assert(tmr.failed, "task should have failed");
        done();
    });
});