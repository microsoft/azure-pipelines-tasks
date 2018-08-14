import tl = require('vsts-task-lib');
import tmrm = require('vsts-task-lib/mock-run');
import ma = require('vsts-task-lib/mock-answer');
import * as path from 'path';
import { setAgentsData, mockTaskArgument } from './utils';

export class DeploymentFactoryTests {

    public static startDeploymentFactoryTests() {
        let tp = path.join(__dirname, 'DeploymentFactoryL0Tests.js');
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

        setAgentsData();

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }

}

DeploymentFactoryTests.startDeploymentFactoryTests();