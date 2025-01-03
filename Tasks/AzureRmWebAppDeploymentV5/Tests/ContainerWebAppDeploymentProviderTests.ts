import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as path from 'path';
import { setEndpointData, setAgentsData, mockTaskArgument, mockTaskInputParameters } from './utils';

export class ContainerWebAppDeploymentProviderTests {

    public static startContainerWebAppDeploymentProviderTests(){
        let tp = path.join(__dirname, 'ContainerWebAppDeploymentProviderL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        mockTaskInputParameters(tr);
        tr.setInput("DockerNamespace", "DockerNamespace");
        tr.setInput("DockerRepository", "DockerRepository");
        tr.setInput("DockerImageTag","DockerImageTag");
        setEndpointData();
        setAgentsData();

        const kudu =  {
            updateDeployment : function(_) {
                return "MOCK_DEPLOYMENT_ID";
            }
        };

        const utility = {
            getKuduService: function()
            {
                return Promise.resolve(kudu);
            }
        };

        tr.registerMock('azure-pipelines-tasks-azure-arm-rest/azureAppServiceUtility', {
            AzureAppServiceUtility: function(_) {
                return utility;
            }
        });

        tr.setAnswers(mockTaskArgument());
        tr.run();

    }

}

ContainerWebAppDeploymentProviderTests.startContainerWebAppDeploymentProviderTests();
