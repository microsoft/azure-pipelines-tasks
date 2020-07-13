
export class TestString {
    public static readonly createReleaseSuccessKeyword: string = "CreateReleaseSuccess";
    public static readonly editReleaseSuccessKeyword: string = "EditReleaseSuccess";
    public static readonly deleteReleaseSuccessKeyword: string = "DeleteReleaseSuccess";
    public static readonly getChangeLogKeyword: string = "getChangeLog method should work properly";
    public static readonly NoTagFoundKeyword: string = "No tag found";
    public static readonly createActionKeyWord: string = "L0Test: create release action method should be called";
    public static readonly deleteActionKeyWord: string = "L0Test: delete action called when action = delete";
    public static readonly deleteAction2KeyWord: string = "L0Test: delete action should be called when action = Delete";
    public static readonly editAction2KeyWord: string = "L0Test: edit release action method should be called when a release is present for given tag";
    public static readonly editActionKeyWord: string = "L0Test: create release action method should be called when no release is present for given tag";
    public static readonly getTagForCreateActionKeyword: string = "getTagForCreateAction method should work properly";
    public static readonly getTagForCreateActionWithTagPatternKeyword: string = "getTagForCreateAction method should work properly when tagPattern is specified";
    public static readonly getCommitShaFromTargetKeyword: string = "getCommitShaFromTarget method should work properly";
    public static readonly getReleaseIdForTagKeyword: string = "getReleaseIdForTag method should work properly";
    public static readonly InvalidActionKeyword: string = "Invalid action input";
    public static readonly getReleaseNoteKeyword: string = "getReleaseNote method should work properly";
    public static readonly validBranchNameKeyword: string = "normalizeBranchName method should return tag name when branch = refs/tags/tagname";
    public static readonly invalidBranchNameKeyword: string = "normalizeBranchName method should return undefined when branch = refs/heads/tagname";
    public static readonly parseHTTPHeaderLinkKeyword: string = "parseHTTPHeaderLink method should work properly";
    public static readonly extractRepositoryOwnerAndNameKeyword: string = "extractRepositoryOwnerAndName method should work properly";
    public static readonly extractRepoAndIssueIdKeyword: string = "extractRepoAndIssueId method should work properly";
    public static readonly getFirstLineKeyword: string = "getFirstLine method should work properly";
    public static readonly tagMatchingKeyword: string = "isTagMatching method should work properly";
    public static readonly allIssuesChangeLog: string = "getChangeLog should generate All Issues ChangeLog";
    public static readonly issueBasedChangeLog: string = "getChangeLog should generate Issue Based ChangeLog";
    public static readonly noCategoryChangeLog: string = "ChangeLog generated should be a flatlist of issues.";
}