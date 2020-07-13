import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as path from 'path';
import { Inputs } from '../operations/Constants';
import * as sinon from 'sinon';

export class CreateAction2L0Tests {
    
    public static startTest() {
        let tp = path.join(__dirname, '..', 'main.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        
        tr.setInput(Inputs.gitHubConnection, "connection");
        tr.setInput(Inputs.repositoryName, "repo");
        tr.setInput(Inputs.action, "create");
        tr.setInput(Inputs.tagSource, "gitTag");
        tr.setInput(Inputs.target, "master");
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
                    getTagForCommitTarget: function() {
                        return null;
                    },
                    publishTelemetry: function() {

                    }
                }
            }
        });        
    }
    
    public static sandbox;
}

CreateAction2L0Tests.startTest();