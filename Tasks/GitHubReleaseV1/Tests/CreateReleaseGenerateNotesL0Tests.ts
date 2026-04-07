import * as path from 'path';

import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as sinon from 'sinon';

import { Inputs } from '../operations/Constants';

export class CreateReleaseGenerateNotesL0Tests {

    public static startTest() {
        let tp = path.join(__dirname, '..', 'main.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);

        tr.setInput(Inputs.gitHubConnection, "connection");
        tr.setInput(Inputs.repositoryName, "repo");
        tr.setInput(Inputs.action, "create");
        tr.setInput(Inputs.tagSource, "userSpecifiedTag");
        tr.setInput(Inputs.tag, "tag");
        tr.setInput(Inputs.target, "master");
        tr.setInput(Inputs.releaseNotesSource, "generateReleaseNotes");

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
                    getTagForCreateAction: function() {
                        return "v1.0.1";
                    },
                    publishTelemetry: function() {

                    }
                }
            }
        });

        tr.registerMock("./operations/Action", {
            Action: function () {
                return {
                    createReleaseAction: (token, repo, target, tag, title, note, isDraft, isPreRelease, assets, makeLatest, generateReleaseNotes) => {
                        if (generateReleaseNotes === true) {
                            console.log("L0Test: create release action called with generateReleaseNotes=true");
                        }
                    }
                }
            }
        });

    }

    public static sandbox;
}

CreateReleaseGenerateNotesL0Tests.startTest();
