import { Utility } from "../operations/Utility";
import { TestString } from "./TestStrings";

export class UtilityL0Tests {

    public static startTests() {
        this.validateGetReleaseNote();
        this.validateNormalizeBranchName();
        this.validateIsTagMatching();
        this.validateParseHTTPHeaderLink();
        this.validateExtractRepositoryOwnerAndName();
        this.validateExtractRepoAndIssueId();
        this.validateGetFirstLine();
    }

    public static validateGetReleaseNote() {
        let releaseNoteInput = "release_note_input";
        let changeLog = "change_log";

        let releaseNote = Utility.getReleaseNote("input", null, releaseNoteInput, changeLog);
        if (releaseNote === (releaseNoteInput + changeLog)) {
            console.log(TestString.getReleaseNoteKeyword);
        }
    }

    public static validateNormalizeBranchName() {
        let normalizedBranchName = "";
        
        normalizedBranchName = Utility.normalizeBranchName("refs/tags/tagName");
        if (normalizedBranchName === "tagName") {
            console.log(TestString.validBranchNameKeyword);
        }

        normalizedBranchName = Utility.normalizeBranchName("refs/heads/tagName");
        if (!normalizedBranchName) {
            console.log(TestString.invalidBranchNameKeyword);
        }
    }

    public static validateIsTagMatching() {
        let tag = "v1.1";
        let tagPattern = "v1.*";
        if (Utility.isTagMatching(tag, tagPattern)) {
            console.log(TestString.tagMatchingKeyword);
        }
    }

    public static validateParseHTTPHeaderLink() {
        let parsedHttpHeaderLink = {};
        let headerLink = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next", <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"';
        let expectedParsedHeaderLink = {
            "next": "https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2",
            "last": "https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34"
        }
        parsedHttpHeaderLink = Utility.parseHTTPHeaderLink(headerLink);

        if (JSON.stringify(parsedHttpHeaderLink) === JSON.stringify(expectedParsedHeaderLink)) {
            console.log(TestString.parseHTTPHeaderLinkKeyword);
        }
    }

    public static validateExtractRepositoryOwnerAndName() {
        let repoName = "owner_name/repo_name";
        let repoInfo = Utility.extractRepositoryOwnerAndName(repoName);

        if (repoInfo.owner === "owner_name" && repoInfo.name === "repo_name") {
            console.log(TestString.extractRepositoryOwnerAndNameKeyword);
        }

    }

    public static validateExtractRepoAndIssueId() {
        let repoIssueId = "repo#26";
        let info = Utility.extractRepoAndIssueId(repoIssueId);

        if (info.repository === "repo" && info.issueId === "26") {
            console.log(TestString.extractRepoAndIssueIdKeyword);
        }
    }

    public static validateGetFirstLine() {
        let message = "Fixing issue #25.\n Description #23";
        let firstLine = Utility.getFirstLine(message);

        if (firstLine === "Fixing issue #25.") {
            console.log(TestString.getFirstLineKeyword);
        }
    }
    
}

UtilityL0Tests.startTests();