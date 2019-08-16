import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as path from 'path';
import { Inputs } from '../operations/Constants';
import * as sinon from 'sinon';

export class ChangeLogTests {

    public static startTest() {
        let tp = path.join(__dirname, 'ChangeLogL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);

        process.env["RELEASE_RELEASEWEBURL"] = "MOCK_RELEASE_URL"; 
        
        // Stub methods
        this.stub(tr);
        
        // Run the main.js 
        tr.run();
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