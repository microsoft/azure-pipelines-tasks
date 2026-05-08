import * as assert from 'assert';
import * as path from 'path';

import tmrm = require('azure-pipelines-task-lib/mock-run');

export class ChangeLogTests {

    public static startTest() {
        this.runIssueRegexTests();

        let tp = path.join(__dirname, 'ChangeLogL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);

        process.env["RELEASE_RELEASEWEBURL"] = "MOCK_RELEASE_URL";

        // Stub methods
        this.stub(tr);

        // Run the main.js
        tr.run();
    }

    private static runIssueRegexTests() {
        const issueRegex = new RegExp(
            "(?<!\\/)" +
            "(?:^|[^A-Za-z0-9_/])" +
            "([a-z0-9_]+\\/[a-zA-Z0-9\\-_.]+)?" +
            "(?:#|[Gg][Hh]-)" +
            "([0-9]+)" +
            "(?=[^A-Za-z0-9_]|$)",
            "gm"
        );

        function findIssues(text: string): { repo: string | undefined; issue: string }[] {
            const results: { repo: string | undefined; issue: string }[] = [];
            let match: RegExpExecArray | null;

            while ((match = issueRegex.exec(text)) !== null) {
                results.push({ repo: match[1], issue: match[2] });
            }

            issueRegex.lastIndex = 0;
            return results;
        }

        {
            const results = findIssues("fix #123");
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].issue, "123");
        }

        {
            const results = findIssues("fixes #10 and #20");
            assert.strictEqual(results.length, 2);
            assert.strictEqual(results[0].issue, "10");
            assert.strictEqual(results[1].issue, "20");
        }

        {
            const results = findIssues("see microsoft/vscode#456");
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].repo, "microsoft/vscode");
            assert.strictEqual(results[0].issue, "456");
        }

        {
            const gh = findIssues("GH-99");
            assert.strictEqual(gh.length, 1);
            assert.strictEqual(gh[0].issue, "99");

            const ghLower = findIssues("gh-50");
            assert.strictEqual(ghLower.length, 1);
            assert.strictEqual(ghLower[0].issue, "50");
        }

        {
            const results = findIssues("(#42)");
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].issue, "42");
        }

        {
            const results = findIssues("#7 is the fix");
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].issue, "7");
        }

        {
            const results = findIssues("relates to #88");
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].issue, "88");
        }

        {
            const results = findIssues("https://playground.example.com/?inspectorv2=true#WO0H1U#165");
            assert.strictEqual(results.length, 0);
        }

        {
            const results = findIssues("https://playground.example.com/?inspectorv2=true#WO0H1U#124");
            assert.strictEqual(results.length, 0);
        }

        {
            const results = findIssues("http://example.com/path/to#123");
            assert.strictEqual(results.length, 0);
        }

        {
            const results = findIssues("someword#123");
            assert.strictEqual(results.length, 0);
        }

        {
            const results = findIssues("https://docs.example.com/page#section#99");
            assert.strictEqual(results.length, 0);
        }
    }

    public static stub(tr) {

        tr.registerMock("./Helper", {
            Helper: function () {
                return {
                    getCommitShaFromTarget: function() {
                        return "abc";
                    },
                    filterTag: function(githubEndpointToken: string, repositoryName: string, filterValue: string, filterTagsCallback: (tagsList: any[], filterValue: string) => any[]) {
                        console.log("Tag Name: "+ filterValue);
                        return { commit: { sha: "abc" } };
                    }
                }
            }
        });

        tr.registerMock("./Release", {
            Release: function () {
                return {
                    getLatestRelease: function() {
                        return {
                            statusCode: 200,
                            body: { "tag_name": "tagName" }
                        }
                    },
                    getReleases: function() {
                        return {
                            statusCode: 200,
                            body: [
                                {
                                    "tag_name": "pre_rel",
                                    "prerelease": true,
                                    "draft": false
                                },
                                {
                                    "tag_name": "v1.2",
                                    "prerelease": false,
                                    "draft": false
                                }
                            ]
                        }
                    },
                    getCommitsList: function() {
                        return {
                            statusCode: 200,
                            body: { "commits": [
                                {"sha": "abc", "commit": { "message": "Fixing issue #2 #3.\n\n desc #4 GH-5" } },
                                {"sha": "xyz", "commit": { "message": "Fixing issue #56.\n\n desc Gh-9" } }
                            ] }
                        };
                    },
                    getIssuesList: function (githubEndpointToken: string, repositoryName: string, issues: number[], includeLabels: boolean) {
                        if (includeLabels) {
                            return {
                                statusCode: 200,
                                body: {
                                    "data": {
                                        "repository": {
                                            "_1": {
                                                "title": "Incorrect color contrast in control panel",
                                                "state": "CLOSED",
                                                "labels": {
                                                    "edges": [
                                                        {
                                                            "node": {
                                                                "name": "bug"
                                                            }
                                                        },
                                                        {
                                                            "node": {
                                                                "name": "ux"
                                                            }
                                                        }
                                                    ]
                                                }
                                            },
                                            "_2": {
                                                "title": "Text alignment confusing in panel",
                                                "state": "OPEN",
                                                "labels": {
                                                    "edges": [
                                                        {
                                                            "node": {
                                                                "name": "bug"
                                                            }
                                                        },
                                                        {
                                                            "node": {
                                                                "name": "ux"
                                                            }
                                                        }
                                                    ]
                                                }
                                            },
                                            "_3": {
                                                "title": "Fixed previous minor bugs",
                                                "state": "OPEN",
                                                "changedFiles": 1,
                                                "labels": {
                                                    "edges": [
                                                        {
                                                            "node": {
                                                                "name": "nit"
                                                            }
                                                        },
                                                        {
                                                            "node": {
                                                                "name": "bug"
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        else {
                            return {
                                statusCode: 200,
                                body: {
                                    "data": {
                                        "repository": {
                                            "_1": {
                                                "title": "Incorrect color contrast in control panel",
                                                "state": "CLOSED",
                                            },
                                            "_2": {
                                                "title": "Text alignment confusing in panel",
                                                "state": "OPEN",
                                            },
                                            "_3": {
                                                "title": "Fixed previous minor bugs",
                                                "state": "OPEN",
                                                "changedFiles": 1,
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
}

ChangeLogTests.startTest();