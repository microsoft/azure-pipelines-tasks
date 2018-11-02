import tl = require('vsts-task-lib');
import tmrm = require('vsts-task-lib/mock-run');
import ma = require('vsts-task-lib/mock-answer');
import { mockTaskArgument, setEndpointData } from './utils';
import path = require('path');


setEndpointData();

export class TaskParametersTests {
    public static ValidateLinuxAppTaskParameters() {
        let tp = path.join(__dirname, 'TaskParametersLinuxAppL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('DeploymentMethod', "auto");
        tr.setInput('WebAppKind', "webAppLinux");
        tr.setInput('RuntimeStack', "dummy|version");
        tr.setInput('BuiltinLinuxPackage', 'webAppPkg.zip');

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }
}

TaskParametersTests.ValidateLinuxAppTaskParameters();