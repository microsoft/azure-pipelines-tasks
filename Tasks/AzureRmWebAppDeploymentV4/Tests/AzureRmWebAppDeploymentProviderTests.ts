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

export class AzureRmWebAppDeploymentProviderTests {

    public static startAzureRmWebAppDeploymentProviderTests(){
        let tp = path.join(__dirname, 'AzureRmWebAppDeploymentProviderL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        mockTaskInputParameters(tr);
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

        tr.registerMock('azure-pipelines-tasks-azure-arm-rest-v2/azureAppServiceUtility', {
            AzureAppServiceUtility: function(_) {
                return utility;
            }
        });

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }

}

AzureRmWebAppDeploymentProviderTests.startAzureRmWebAppDeploymentProviderTests();
