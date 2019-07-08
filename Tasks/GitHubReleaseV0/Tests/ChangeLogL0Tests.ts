import { ChangeLog } from "../operations/ChangeLog";
import { TestString } from "./TestStrings";
import { ChangeLogStartCommit } from "../operations/Utility";

export class ChangeLogL0Tests {
    public static async startTests() {
        await this.validateGetChangeLog1();
        await this.validateGetChangeLog2();
        await this.validateGetChangeLog3();
    }

    public static async validateGetChangeLog1() {
        let changes = await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastFullRelease);
    
        if (changes === this.expectedChanges) {
            console.log(TestString.getChangeLogKeyword);
        }
    }

    public static async validateGetChangeLog2() {
        let changes = await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastRelease);
        
        if (changes === this.expectedChanges) {
            console.log(TestString.getChangeLogKeyword);
        }
    }

    public static async validateGetChangeLog3() {
        let changes = await new ChangeLog().getChangeLog("endpoint", "owner/repo", "target", 250, ChangeLogStartCommit.lastReleaseByTag, "v1.*");
        
        if (changes === this.expectedChanges) {
            console.log(TestString.getChangeLogKeyword);
        }
    }

    public static readonly expectedChanges = "\n\n## Changes:\n\n* xyz Fixing issue #56. [ #9 ]\n* abc Fixing issue #2 #3. [ #4, #5 ]\n\nThis list of changes was [auto generated](MOCK_RELEASE_URL).";

}

ChangeLogL0Tests.startTests();