import { Helper } from "../operations/Helper";
import { TestString } from "./TestStrings";

export class HelperL0Tests {
    public static async startTests() {
        await this.validateGetTagForCreateAction();
        await this.validateGetCommitShaFromTarget();
        await this.validateGetReleaseIdForTag();
    }

    public static async validateGetTagForCreateAction() {
        let tag = await new Helper().getTagForCommitTarget("endpoint", "repo", "abc");

        if (tag === "tagName") {
            console.log(TestString.getTagForCreateActionKeyword);
        }
    }

    public static async validateGetCommitShaFromTarget() {
        let target = "master";
        let sha = await new Helper().getCommitShaFromTarget("endpoint", "repo", target);

        if (sha === "abc") {
            console.log(TestString.getCommitShaFromTargetKeyword);
        }
    }

    public static async validateGetReleaseIdForTag() {
        let releaseId = await new Helper().getReleaseIdForTag("endpoint", "repo", "tagName");
        
        if (releaseId === 456) {
            console.log(TestString.getReleaseIdForTagKeyword);
        }
    }
    
}

HelperL0Tests.startTests();