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

}

ChangeLogL0Tests.startTests();