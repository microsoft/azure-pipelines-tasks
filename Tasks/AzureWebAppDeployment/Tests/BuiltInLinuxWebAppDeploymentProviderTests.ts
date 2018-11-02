import tl = require('vsts-task-lib');
import tmrm = require('vsts-task-lib/mock-run');
import ma = require('vsts-task-lib/mock-answer');
import * as path from 'path';
import { AzureAppService } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service';
import { AzureAppServiceUtility } from 'azurermdeploycommon/operations/AzureAppServiceUtility';
import { KuduServiceUtility } from 'azurermdeploycommon/operations/KuduServiceUtility';
import { setEndpointData, setAgentsData, mockTaskArgument, mockTaskInputParameters } from './utils';

export class BuiltInLinuxWebAppDeploymentProviderTests {

    public static startBuiltInLinuxWebAppDeploymentProviderTests(){
        let tp = path.join(__dirname, 'BuiltInLinuxWebAppDeploymentProviderL0Tests.js');
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
                    },
                    deployUsingZipDeploy: function(E,F,G) {
                        return "ZIP_DEPLOY_SUCCESS_ID";
                    },
                    deployUsingWarDeploy: function(H,I,J) {
                        return "ZIP_DEPLOY_SUCCESS_ID";
                    }
                }
            }
        });

        tr.registerMock('azurermdeploycommon/operations/AzureAppServiceUtility.js', {
            Kudu: function(A,B,C) {},
            getKuduService : function() {
                return new this.Kudu;
            },
            getApplicationURL: function (D) {
                return "http://mytestapp.azurewebsites.net";
            },
            updateStartupCommandAndRuntimeStack: function(D,E) {}
        });

        tr.registerMock('azurermdeploycommon/webdeployment-common/utility.js', {
            generateTemporaryFolderForDeployment: function () {
                return "webAppPkg";
            },
            archiveFolderForDeployment: function() {
                return {
                    "webDeployPkg": "webAppPkg",
                    "tempPackagePath": "webAppPkg"
                };
            },
            getFileNameFromPath: function(A, B) {
                return "webAppPkg";
            },
            generateTemporaryFolderOrZipPath: function(C, D) {
                return "webAppPkg.zip";
            }
        });
        
        tr.registerMock('azurermdeploycommon/webdeployment-common/ziputility.js', {
            archiveFolder: function(A, B){
                return "webAppPkg.zip";
            }
        });

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }
    

}

BuiltInLinuxWebAppDeploymentProviderTests.startBuiltInLinuxWebAppDeploymentProviderTests();
