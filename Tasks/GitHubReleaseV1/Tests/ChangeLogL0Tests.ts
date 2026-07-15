import { ChangeLog } from "../operations/ChangeLog";
import { ChangeLogStartCommit } from "../operations/Utility";
import { TestString } from "./TestStrings";
import * as assert from "assert";

const GRAPHQL_ERROR_TYPE_ENV_VAR: string = "TEST_GRAPHQL_ERROR_TYPE";

export class ChangeLogL0Tests {
    public static async startTests() {
        await this.validateGetChangeLog1();
        await this.validateGetChangeLog2();
        await this.validateGetChangeLog3();
        await this.validateGetChangeLog4();
        await this.validateGetChangeLog5();
        await this.validateGetChangeLog6();
        await this.validateGetChangeLogFailsFastOnBlockingGraphQLErrors();
    }

    public static async validateGetChangeLog1() {
        let changes = await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastFullRelease, "commitBased");

        if (changes === this.expectedCommitBasedChanges) {
            console.log(TestString.getChangeLogKeyword);
        }
    }

    public static async validateGetChangeLog2() {
        await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastNonDraftRelease, "commitBased");
    }

    public static async validateGetChangeLog3() {
        await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastNonDraftReleaseByTag, "commitBased", "v1.*");
    }

    public static async validateGetChangeLog4(){
        let changes = await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastFullRelease, "issueBased", null, []);
        if (changes === this.expectedAllIssuesChanges) {
            console.log(TestString.allIssuesChangeLog);
        }
    }

    public static async validateGetChangeLog5(){
        let changeLogLabels = `[{"label": "ux", "displayName": "Closed UX Issues/PRs", "state": "CLOSED"}, {"label" : "bug", "displayName": "Open Bugs", "state": "OPEN"}]`;
        let changes = await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastFullRelease, "issueBased", null, JSON.parse(changeLogLabels));
        if (changes === this.expectedIssueBasedChanges) {
            console.log(TestString.issueBasedChangeLog);
        }
    }

    public static async validateGetChangeLog6(){
        let changeLogLabels = `[{"label": "hello", "displayName": "Closed UX Issues/PRs", "state": "CLOSED"}, {"label" : "nope", "displayName": "Open Bugs", "state": "OPEN"}]`;
        let changes = await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastFullRelease, "issueBased", null, JSON.parse(changeLogLabels));

        if (changes === this.expectedAllIssuesChanges) {
            console.log(TestString.noCategoryChangeLog);
        }
    }

    public static async validateGetChangeLogFailsFastOnBlockingGraphQLErrors() {
        let changes = "";
        process.env[GRAPHQL_ERROR_TYPE_ENV_VAR] = "RATE_LIMITED";
        try {
            changes = await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastFullRelease, "issueBased", null, []);
        }
        finally {
            delete process.env[GRAPHQL_ERROR_TYPE_ENV_VAR];
        }
        assert.strictEqual(changes, "");
        console.log(TestString.issueFetchFailFastChangeLog);
    }

    public static readonly expectedCommitBasedChanges = "\n\n## loc_mock_ChangeLogTitle:\n\n* xyz Fixing issue #56. [ #9 ]\n* abc Fixing issue #2 #3. [ #4, #5 ]\n\nThis list of changes was [auto generated](MOCK_RELEASE_URL).";
    public static readonly expectedAllIssuesChanges = "\n\n## loc_mock_ChangeLogTitle:\n\n* #1: Incorrect color contrast in control panel\n* #2: Text alignment confusing in panel\n* #3: Fixed previous minor bugs\n\nThis list of changes was [auto generated](MOCK_RELEASE_URL).";
    public static readonly expectedIssueBasedChanges = "\n\n## loc_mock_ChangeLogTitle:\n\n\n### Closed UX Issues/PRs:\n\n\n* #1: Incorrect color contrast in control panel\n\n### Open Bugs:\n\n\n* #2: Text alignment confusing in panel\n* #3: Fixed previous minor bugs\n\nThis list of changes was [auto generated](MOCK_RELEASE_URL).";

}

ChangeLogL0Tests.startTests();