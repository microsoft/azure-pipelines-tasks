import tmrm = require('vsts-task-lib/mock-run');
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
                    filterTag: function() {
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
                    getCommitsList: function() {
                        return {
                            statusCode: 200,
                            body: { "commits": [ 
                                {"sha": "abc", "commit": { "message": "Fixing issue #2 #3.\n\n desc #4 GH-5" } },
                                {"sha": "xyz", "commit": { "message": "Fixing issue #56.\n\n desc Gh-9" } }
                            ] }
                        }
                    }
                }
            }
        });
    }
}

ChangeLogTests.startTest();