import tmrm = require('vsts-task-lib/mock-run');
import * as path from 'path';
import { setEndpointData, setAgentsData, mockTaskArgument, mockTaskInputParameters } from './utils';

export class AzureRmWebAppDeploymentProviderTests {

    public static startAzureRmWebAppDeploymentProviderTests(){
        let tp = path.join(__dirname, 'AzureRmWebAppDeploymentProviderL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        mockTaskInputParameters(tr);
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

AzureRmWebAppDeploymentProviderTests.startAzureRmWebAppDeploymentProviderTests();
