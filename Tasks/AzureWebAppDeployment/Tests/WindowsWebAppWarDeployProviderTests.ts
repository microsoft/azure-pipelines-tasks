import tl = require('vsts-task-lib');
import tmrm = require('vsts-task-lib/mock-run');
import ma = require('vsts-task-lib/mock-answer');
import * as path from 'path';
import { setEndpointData, setAgentsData, mockTaskArgument, mockTaskInputParameters } from './utils';

export class WindowsWebAppWarDeployProviderTests {

    public static startWindowsWebAppWarDeployProviderTests(){
        let tp = path.join(__dirname, 'WindowsWebAppWarDeployProviderL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        mockTaskInputParameters(tr);
        setEndpointData();
        setAgentsData();

        tr.registerMock('azurermdeploycommon/operations/KuduServiceUtility', {
            KuduServiceUtility: function(A) {
                return {                    
                    updateDeploymentStatus : function(B,C,D) {
                        return "MOCK_DEPLOYMENT_ID";
                    },
                    warmUp: function() {
                        console.log('warmed up Kudu Service');
                    }
                }
            }
        });

        tr.registerMock('azurermdeploycommon/azure-arm-rest/azure-arm-app-service-kudu', {
            Kudu: function(A, B, C) {
                return {
                    getAppSettings : function() {
                        var map: Map<string, string> = new Map<string, string>();
                        map.set('MSDEPLOY_RENAME_LOCKED_FILES', '1');
                        map.set('ScmType', 'ScmType');
                        map.set('WEBSITE_RUN_FROM_PACKAGE', '1');
                        return map;
                    },
                    zipDeploy: function(E, F) {
                        return '{id: "ZIP_DEPLOY_FAILED_ID", status: 3, deployer: "VSTS_ZIP_DEPLOY", author: "VSTS USER"}';
                    },
                    warDeploy: function(G, H) {
                        return '{id: "ZIP_DEPLOY_FAILED_ID", status: 3, deployer: "VSTS_ZIP_DEPLOY", author: "VSTS USER"}';
                    },
                    getDeploymentDetails: function(I) {
                        return "{ type: 'Deployment',url: 'http://MOCK_SCM_WEBSITE/api/deployments/MOCK_DEPLOYMENT_ID'}";
                    }  
                }
            }
        });

        tr.registerMock('azurermdeploycommon/operations/AzureAppServiceUtility.js', {
            getApplicationURL: function (A) {
                return "http://mytestapp.azurewebsites.net";
            }
        });
        

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }

}

WindowsWebAppWarDeployProviderTests.startWindowsWebAppWarDeployProviderTests();
