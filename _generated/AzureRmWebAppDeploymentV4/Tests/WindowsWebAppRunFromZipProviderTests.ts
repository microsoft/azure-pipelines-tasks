import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as path from 'path';
import { setEndpointData, setAgentsData, mockTaskArgument, mockTaskInputParameters } from './utils';

export class WindowsWebAppRunFromZipProviderTests {

    public static startWindowsWebAppRunFromZipProviderTests(){
        let tp = path.join(__dirname, 'WindowsWebAppRunFromZipProviderL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        mockTaskInputParameters(tr);
        setEndpointData();
        setAgentsData();


        const kudu =  {
            updateDeployment : function(D) {
                return "MOCK_DEPLOYMENT_ID";
            },
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


        tr.registerMock('azure-pipelines-tasks-webdeployment-common/utility.js', {
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
        
        tr.registerMock('azure-pipelines-tasks-webdeployment-common/ziputility.js', {
            archiveFolder: function(A, B){
                return "webAppPkg.zip";
            }
        });
        

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }

}

WindowsWebAppRunFromZipProviderTests.startWindowsWebAppRunFromZipProviderTests();
