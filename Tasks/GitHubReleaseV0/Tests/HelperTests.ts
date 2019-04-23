import tmrm = require('vsts-task-lib/mock-run');
import * as path from 'path';
import { Inputs } from '../operations/Constants';
import * as sinon from 'sinon';

export class HelperTests {

    public static startTest() {
        let tp = path.join(__dirname, 'HelperL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        
        // Stub methods
        this.stub(tr);
        
        // Run the main.js 
        tr.run();
    }

    public static stub(tr) {

        tr.registerMock("./Release", {
            Release: function () {
                return {
                    getTags: function() {
                        return {
                            statusCode: 200,
                            headers: { "link": ""},
                            body: [
                                { 
                                    "commit": { "sha": "abc" },
                                    "name": "tagName"
                                }
                            ]
                        }
                    },
                    getBranch: function() {
                        return {
                            statusCode: 200,
                            body: { commit: { sha: "abc" } }
                        }
                    },
                    getReleases: function() {
                        return {
                            statusCode: 200,
                            body: [
                                {"tag_name": "abc", "id": 123},
                                {"tag_name": "tagName", "id": 456}
                            ],
                            headers: {}
                        }
                    }
                }
            }
        });
    }
}

HelperTests.startTest();