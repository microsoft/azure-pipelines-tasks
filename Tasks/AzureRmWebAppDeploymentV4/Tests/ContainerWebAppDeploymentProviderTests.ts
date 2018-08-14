import tl = require('vsts-task-lib');
import tmrm = require('vsts-task-lib/mock-run');
import ma = require('vsts-task-lib/mock-answer');
import * as path from 'path';
import { AzureResourceFilterUtility } from '../operations/AzureResourceFilterUtility';
import { KuduServiceUtility } from '../operations/KuduServiceUtility';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import { ApplicationTokenCredentials } from 'azure-arm-rest/azure-arm-common';
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint'; 
import { setEndpointData, setAgentsData, mockTaskArgument } from './utils';

export class ContainerWebAppDeploymentProviderTests {

    public static startContainerWebAppDeploymentProviderTests(){
        let tp = path.join(__dirname, 'ContainerWebAppDeploymentProviderL0Tests.js');
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
        
        setEndpointData();
        setAgentsData();

        tr.registerMock('azure-arm-rest/azure-arm-app-service-kudu', {
            Kudu: function(A, B, C) {
                return {
                    updateDeployment : function(D) {
                        return "MOCK_DEPLOYMENT_ID";
                    }
                }
            }
        });

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }

}

ContainerWebAppDeploymentProviderTests.startContainerWebAppDeploymentProviderTests();