import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as path from 'path';
import { Inputs } from '../operations/Constants';
import * as sinon from 'sinon';

export class EditAction2L0Tests {
    
    public static startTest() {
        let tp = path.join(__dirname, '..', 'main.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        
        tr.setInput(Inputs.gitHubConnection, "connection");
        tr.setInput(Inputs.repositoryName, "repo");
        tr.setInput(Inputs.action, "edit");
        tr.setInput(Inputs.target, "master");
        tr.setInput(Inputs.tagSource, "manual");
        tr.setInput(Inputs.tag, "v1.0.0");
        tr.setInput(Inputs.releaseNotesSource, "inline");
        
        this.stub(tr);
        tr.run();

        this.sandbox.restore();
    }
    
    public static stub(tr) {
        this.sandbox = sinon.sandbox.create();
        
        var Utility = require('../operations/Utility');
        this.sandbox.stub(Utility.Utility, "getGithubEndPointToken").callsFake(function() { return { scheme: 'OAuth', parameters: { AccessToken: "**someToken**"}} });

        tr.registerMock("./operations/Helper", {
            Helper: function () {
                return {
                    getReleaseIdForTag: () => {
                        return "123";
                    },
                    publishTelemetry: () => {

                    }
                }
            }
        });

        tr.registerMock("./operations/Action", {
            Action: function () {
                return {
                    editReleaseAction: () => {
                        console.log("L0Test: edit release action method should be called when a release is present for given tag"); // = this.editAction2KeyWord
                    }
                }
            }
        });
        
    }
    
    public static sandbox;
}

EditAction2L0Tests.startTest();