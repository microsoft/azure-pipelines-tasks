
export class TestString {
    public static readonly createReleaseSuccessKeyword = "CreateReleaseSuccess";
    public static readonly editReleaseSuccessKeyword = "EditReleaseSuccess";
    public static readonly deleteReleaseSuccessKeyword = "DeleteReleaseSuccess";
    public static readonly getChangeLogKeyword = "getChangeLog method should work properly";
    public static readonly NoTagFoundKeyword: string = "No tag found";
    public static readonly createActionKeyWord: string = "L0Test: create release action method should be called";
    public static readonly deleteActionKeyWord: string = "L0Test: delete action called when action = delete";
    public static readonly deleteAction2KeyWord: string = "L0Test: delete action should be called when action = Delete";
    public static readonly editAction2KeyWord: string = "L0Test: edit release action method should be called when a release is present for given tag";
    public static readonly editActionKeyWord: string = "L0Test: create release action method should be called when no release is present for given tag";
    public static readonly getTagForCreateActionKeyword = "getTagForCreateAction method should work properly";
    public static readonly getCommitShaFromTargetKeyword = "getCommitShaFromTarget method should work properly";
    public static readonly getReleaseIdForTagKeyword = "getReleaseIdForTag method should work properly";
    public static readonly InvalidActionKeyword: string = "Invalid action input";
    public static readonly getReleaseNoteKeyword = "getReleaseNote method should work properly";
    public static readonly validBranchNameKeyword = "normalizeBranchName method should return tag name when branch = refs/tags/tagname";
    public static readonly invalidBranchNameKeyword = "normalizeBranchName method should return undefined when branch = refs/heads/tagname";
    public static readonly parseHTTPHeaderLinkKeyword = "parseHTTPHeaderLink method should work properly";
    public static readonly extractRepositoryOwnerAndNameKeyword = "extractRepositoryOwnerAndName method should work properly";
    public static readonly extractRepoAndIssueIdKeyword = "extractRepoAndIssueId method should work properly";
    public static readonly getFirstLineKeyword = "getFirstLine method should work properly";
}