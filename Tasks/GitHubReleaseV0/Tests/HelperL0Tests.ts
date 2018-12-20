import { Helper } from "../operations/Helper";

export class HelperL0Tests {
    public static async startTests() {
        await this.validateGetTagForCreateAction();
        await this.validateGetCommitShaFromTarget();
        await this.validateGetReleaseIdForTag();
    }

    public static async validateGetTagForCreateAction() {
        let tag = await new Helper().getTagForCreateAction("endpoint", "repo", "target", "tagName");

        if (tag === "tagName") {
            console.log(this.getTagForCreateActionKeyword);
        }
    }

    public static async validateGetCommitShaFromTarget() {
        let target = "master";
        let sha = await new Helper().getCommitShaFromTarget("endpoint", "repo", target);

        if (sha === "abc") {
            console.log(this.getCommitShaFromTargetKeyword);
        }
    }

    public static async validateGetReleaseIdForTag() {
        let releaseId = await new Helper().getReleaseIdForTag("endpoint", "repo", "tagName");
        
        if (releaseId === 456) {
            console.log(this.getReleaseIdForTagKeyword);
        }
    }
    
    public static readonly getTagForCreateActionKeyword = "getTagForCreateAction method should work properly";
    public static readonly getCommitShaFromTargetKeyword = "getCommitShaFromTarget method should work properly";
    public static readonly getReleaseIdForTagKeyword = "getReleaseIdForTag method should work properly";
}

HelperL0Tests.startTests();