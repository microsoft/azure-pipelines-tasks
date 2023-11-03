import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import ma = require('azure-pipelines-task-lib/mock-answer');
import { mockTaskArgument, setEndpointData } from './utils';
import path = require('path');


setEndpointData();

export class TaskParametersTests {
    public static ValidateLinuxAppTaskParameters() {
        let tp = path.join(__dirname, 'TaskParametersLinuxAppL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        tr.setInput("ConnectionType", "AzureRM");
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'false');
        tr.setInput('ImageSource', "Builtin Image");
        tr.setInput('WebAppKind', "webAppLinux");
        tr.setInput('RuntimeStack', "dummy|version");
        tr.setInput('BuiltinLinuxPackage', 'webAppPkg.zip');
        tr.setInput('ScriptType', 'Inline Script');
        tr.setInput('InlineScript','npm install --production');

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }
}

TaskParametersTests.ValidateLinuxAppTaskParameters();