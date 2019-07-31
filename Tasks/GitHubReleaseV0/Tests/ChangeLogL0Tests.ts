import { ChangeLog } from "../operations/ChangeLog";
import { TestString } from "./TestStrings";

export class ChangeLogL0Tests {
    public static async startTests() {
        await this.validateGetChangeLog();
    }

    public static async validateGetChangeLog() {
        let changes = await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250);
        let expectedChanges = "\n\n## Changes:\n\n* xyz Fixing issue #56. [ #9 ]\n* abc Fixing issue #2 #3. [ #4, #5 ]\n\nThis list of changes was [auto generated](MOCK_RELEASE_URL).";

        if (changes === expectedChanges) {
            console.log(TestString.getChangeLogKeyword);
        }
    }

<<<<<<< HEAD
=======
    public static async validateGetChangeLog2() {
        await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastNonDraftRelease);
    }

    public static async validateGetChangeLog3() {
        await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastNonDraftReleaseByTag, "v1.*");
    }

    public static readonly expectedChanges = "\n\n## Changes:\n\n* xyz Fixing issue #56. [ #9 ]\n* abc Fixing issue #2 #3. [ #4, #5 ]\n\nThis list of changes was [auto generated](MOCK_RELEASE_URL).";

>>>>>>> ec205fb64... GitHubRelease Task: ChangeLog enhancements: Changes after PM Review (#10986)
}

ChangeLogL0Tests.startTests();