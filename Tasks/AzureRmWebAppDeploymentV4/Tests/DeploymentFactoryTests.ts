import tl = require('vsts-task-lib');
import tmrm = require('vsts-task-lib/mock-run');
import ma = require('vsts-task-lib/mock-answer');
import * as path from 'path';
import { setAgentsData, mockTaskArgument, mockTaskInputParameters } from './utils';

export class DeploymentFactoryTests {

    public static startDeploymentFactoryTests() {
        let tp = path.join(__dirname, 'DeploymentFactoryL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        mockTaskInputParameters(tr);
        setAgentsData();

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }

}

DeploymentFactoryTests.startDeploymentFactoryTests();
