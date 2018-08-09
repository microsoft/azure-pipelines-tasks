import tl = require('vsts-task-lib');
import tmrm = require('vsts-task-lib/mock-run');
import ma = require('vsts-task-lib/mock-answer');
import * as path from 'path';

export class DeploymentFactoryTests {

    public static startDeploymentFactoryL0Tests(){
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
        
        process.env['TASK_TEST_TRACE'] = 1;
        process.env["AZURE_HTTP_USER_AGENT"] = "TFS_useragent";
        process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";
        process.env["AGENT_NAME"] = "author";
        process.env["AGENT_TEMPDIRECTORY"] = 'Agent.TempDirectory';
        
        // provide answers for task mock
        let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "which": {
                "cmd": "cmd"
            },
            "stats": {
                "webAppPkg.zip": {
                    "isFile": true
                }
            },
            "osType": {
                "osType": "Linux"
            },
            "checkPath": {
                "cmd": true,
                "webAppPkg.zip": true,
                "webAppPkg": true
            },
            "exist": {
                "webAppPkg.zip": true,
                "webAppPkg": true
            }
        }

        tr.setAnswers(a);
        tr.run();
    }

}

DeploymentFactoryTests.startDeploymentFactoryL0Tests();