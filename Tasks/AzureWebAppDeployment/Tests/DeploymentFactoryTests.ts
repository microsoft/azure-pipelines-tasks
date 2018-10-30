import tmrm = require('vsts-task-lib/mock-run');
import * as path from 'path';
import { setAgentsData, mockTaskArgument, mockTaskInputParameters, setEndpointData } from './utils';

export class DeploymentFactoryTests {

    public static startDeploymentFactoryTests() {
        let tp = path.join(__dirname, 'DeploymentFactoryL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        mockTaskInputParameters(tr);
        setEndpointData();
        setAgentsData();

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }

}

DeploymentFactoryTests.startDeploymentFactoryTests();
