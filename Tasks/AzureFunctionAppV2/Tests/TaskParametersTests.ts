import tmrm = require('azure-pipelines-task-lib/mock-run');
import { setAgentsData, setEndpointData, mockTaskArgument } from './utils';

import path = require('path');

setEndpointData();

export class TaskParametersTests {
    public static async ValidateTaskParameters() {
        let tp = path.join(__dirname, 'TaskParametersL0Tests.js');
        let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);

        tr.setInput('azureSubscription', 'AzureRMSpn');
        tr.setInput('appName', 'mytestfunctionapp');
        tr.setInput('package', 'webAppPkg.zip');
        tr.setInput('appType', 'functionApp');
        tr.setInput('deploymentMethod', 'auto');

        setAgentsData();

        const answers = mockTaskArgument();
        tr.setAnswers(answers);
        tr.run();
    }
}

TaskParametersTests.ValidateTaskParameters();
