import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import msRestAzure = require('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common');
import path = require('path');
import mockTask = require('azure-pipelines-task-lib/mock-task');

const taskPath = path.join(__dirname, '..', 'javatoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("versionSpec", "8.1");
tr.setInput("jdkSourceOption", "AzureStorage")
tr.setInput("jdkArchitectureOption", "x64");
tr.setInput("azureResourceManagerEndpoint", "ARM1");
tr.setInput("azureStorageAccountName", "storage1");
tr.setInput("azureContainerName", "container1");
tr.setInput("azureCommonVirtualFile", "JDKname.tar.gz");
tr.setInput("jdkDestinationDirectory", "DestinationDirectory");
tr.setInput("cleanDestinationDirectory", "false");

process.env['AGENT_TOOLSDIRECTORY'] = '/tool';
process.env['AGENT_VERSION'] = '2.194.0';

process.env['ENDPOINT_URL_ID1'] = 'http://url';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_username'] = 'dummyusername';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_password'] = 'dummypassword';
process.env['ENDPOINT_DATA_ID1_acceptUntrustedCerts'] = 'true';

process.env['ENDPOINT_URL_ARM1'] = 'http://url';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_serviceprincipalid'] = 'dummyid';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_serviceprincipalkey'] = 'dummykey';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_tenantid'] = 'dummyTenantid';
process.env['ENDPOINT_DATA_ARM1_environmentAuthorityUrl'] = 'dummyurl';
process.env['ENDPOINT_DATA_ARM1_activeDirectoryServiceEndpointResourceId'] = 'dummyResourceId';
process.env['ENDPOINT_DATA_ARM1_subscriptionId'] = 'dummySubscriptionId';

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "stats": {
        "DestinationDirectory\\JDKname.tar.gz": true,
        "DestinationDirectory/JDKname.tar.gz": true,        
    },
    "find": {
        "DestinationDirectory": ["rootJDK/", "rootJDK/secondlevelJDK2"],
    },
};

tr.setAnswers(a);

tr.registerMock("azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-storage", {
    StorageManagementClient: function (A, B) {
        return {
            storageAccounts: {
                get: function (A) {
                    return {
                        properties: {
                            primaryEndpoints: {
                                blob: "primaryBlobUrl"
                            }
                        },
                        id: "StorageAccountUrl"
                    }
                },
                listkeys: function (A, B, C) {
                    return ["accesskey1", "accessKey2"];
                }
            }
        }
    },
    StorageAccounts: {
        getResourceGroupNameFromUri: function (A) {
            return "storageAccountResouceGroupName";
        }
    }
});

tr.registerMock("azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common", {
    ApplicationTokenCredentials: function(A,B,C,D,E,F,G) {
        return {};
    }
});

tr.registerMock('./AzureStorageArtifacts/AzureStorageArtifactDownloader',{
    AzureStorageArtifactDownloader: function(A,B,C) {
        return {
            downloadArtifacts: function(A,B) {
                        return "pathFromDownloader";
            } 
        }
    }
})

const mtl = require("azure-pipelines-tool-lib/tool")
const mtlClone = Object.assign({}, mtl);

mtlClone.prependPath = function(variable1: string, variable2: string) {
    return {};
};

tr.registerMock("azure-pipelines-tool-lib/tool", mtlClone);

const mfs = require('fs')
const mfsClone = Object.assign({}, mfs);

mfsClone.lstatSync = function(variable: string) {
    return {
        isDirectory: function() {
            return true; 
        }
    };
};

mfsClone.existsSync = function (variable: string) {
    if (variable === "DestinationDirectory\\econdlevelJDK2" || variable === "DestinationDirectory/econdlevelJDK2") {
        return false;
    } else return true;
}

tr.registerMock('fs', mfsClone);

tr.run();
