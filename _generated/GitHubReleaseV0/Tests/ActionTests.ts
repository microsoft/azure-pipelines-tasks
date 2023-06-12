import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as path from 'path';
import * as sinon from 'sinon';
import { Inputs } from '../operations/Constants';

export class ActionTests {

    public static startTest() {
        let tp = path.join(__dirname, 'ActionL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        
        tr.setInput(Inputs.assetUploadMode, "replace");

        this.stub(tr);
        
        tr.run();
    }

    public static stub(tr) {

        tr.registerMock("./Release", {
            Release: function () {
                return {
                    createRelease: async function() {
                        return {
                            statusCode: 201,
                            body: { "upload_url": "url" }
                        }
                    },
                    editRelease: function() {
                        return {
                            statusCode: 200,
                            body: { "html_url": "url" }
                        }
                    },
                    deleteRelease: function() {
                        return {
                            statusCode: 204
                        }
                    },
                    uploadReleaseAsset: function() {
                        return {
                            statusCode: 201
                        }
                    }
                }
            }
        });
        
        tr.registerMock("./Helper", {
            Helper: function () {
                return {
                    getReleaseIdForTag: function() {
                        return "id";
                    }
                }
            }
        });
    }
    
}

ActionTests.startTest();