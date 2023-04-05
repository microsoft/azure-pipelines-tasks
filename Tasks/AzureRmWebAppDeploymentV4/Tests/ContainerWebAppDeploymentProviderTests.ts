import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import ma = require('azure-pipelines-task-lib/mock-answer');
import * as path from 'path';
import { AzureResourceFilterUtility } from '../operations/AzureResourceFilterUtility';
import { KuduServiceUtility } from '../operations/KuduServiceUtility';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { ApplicationTokenCredentials } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint'; 
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

        tr.registerMock('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service-kudu', {
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
