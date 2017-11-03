import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import mockTask = require('vsts-task-lib/mock-task');

const taskPath = path.join(__dirname, '..', 'javatoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("versionSpec", "8.1");
tr.setInput("jdkSourceOption", "AzureStorage")
tr.setInput("jdkArchitectureOption", "x64");
tr.setInput("azureResourceManagerEndpoint", "ARM1");
tr.setInput("azureStorageAccountName", "storage1");
tr.setInput("azureContainerName", "container1");
tr.setInput("azureCommonVirtualFile", "");
tr.setInput("jdkDestinationDirectory", "javaJDK");
tr.setInput("cleanDestinationDirectory", "false");

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

tr.registerMock("azure-arm-rest/azure-arm-storage", {
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

tr.registerMock("azure-arm-rest/azure-arm-common", {
    ApplicationTokenCredentials: function(A,B,C,D,E,F,G) {
        return {};
    }
});

tr.registerMock("azure-blobstorage-artifactProvider/blobservice", {
    BlobService: function(A,B) {
        return {
            downloadBlobs: function(A,B,C,D) {
                return;
            }
        }
    }
});

tr.run();
