import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as path from 'path';
import { Inputs } from '../operations/Constants';
import * as sinon from 'sinon';
import { TestString } from './TestStrings';

export class DeleteActionL0Tests {

    public static startTest() {
        let tp = path.join(__dirname, '..', 'main.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        
        // Set the input
        tr.setInput(Inputs.gitHubConnection, "connection");
        tr.setInput(Inputs.repositoryName, "repo");
        tr.setInput(Inputs.action, "delete");
        tr.setInput(Inputs.tag, "tag");

        // Stub methods
        this.stub();
        
        // Run the main.js 
        tr.run();

        // Restore all stubs
        this.sandbox.restore();
    }

    public static stub() {
        this.sandbox = sinon.sandbox.create();

        var Utility = require('../operations/Utility');
        this.sandbox.stub(Utility.Utility, "getGithubEndPointToken").callsFake(function() { return { scheme: 'OAuth', parameters: { AccessToken: "**someToken**"}} });
        
        var Action = require('../operations/Action');
        this.sandbox.stub(Action.Action.prototype, "deleteReleaseAction").callsFake(() => { console.log(TestString.deleteActionKeyWord) });
    }
    
    public static sandbox;
}

DeleteActionL0Tests.startTest();