import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import mockTask = require('azure-pipelines-task-lib/mock-task');

const taskPath = path.join(__dirname, '..', 'jenkinsdownloadartifacts.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("serverEndpoint", "ID1");
tr.setInput("jobName", "myfreestyleproject")
tr.setInput("saveTo", "jenkinsArtifacts");
tr.setInput("filePath", "/");
tr.setInput("jenkinsBuild", "BuildNumber");
tr.setInput("propagatedArtifacts", "true");
tr.setInput("artifactProvider", "azureStorage");
tr.setInput("ConnectedServiceNameARM", "ARM1");
tr.setInput("storageAccountName", "storage1");
tr.setInput("containerName", "container1");
tr.setInput("commonVirtualPath", "");
tr.setInput("jenkinsBuildNumber", "20");
tr.setInput("itemPattern", "**");
tr.setInput("downloadCommitsAndWorkItems", "false");

process.env['ENDPOINT_URL_ID1'] = 'http://url';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_USERNAME'] = 'dummyusername';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_PASSWORD'] = 'dummypassword';
process.env['ENDPOINT_DATA_ID1_ACCEPTUNTRUSTEDCERTS'] = 'true';

process.env['ENDPOINT_URL_ARM1'] = 'http://url';
process.env['ENDPOINT_AUTH_PARAMETER_ARM1_SERVICEPRINCIPALID'] = 'dummyid';
process.env['ENDPOINT_AUTH_PARAMETER_ARM1_SERVICEPRINCIPALKEY'] = 'dummykey';
process.env['ENDPOINT_AUTH_PARAMETER_ARM1_TENANTID'] = 'dummyTenantid';
process.env['ENDPOINT_DATA_ARM1_ENVIRONMENTAUTHORITYURL'] = 'dummyurl';
process.env['ENDPOINT_DATA_ARM1_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID'] = 'dummyResourceId';
process.env['ENDPOINT_DATA_ARM1_SUBSCRIPTIONID'] = 'dummySubscriptionId';

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
                listKeys: function (A, B, C, D) {
                    return ["accesskey1", "accessKey2"];
                },
                listClassicAndRMAccounts: function(A) {
                    return [
                        {
                            name : "storage1"
                        }
                    ];
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

tr.registerMock("./blobservice", {
    BlobService: function(A,B) {
        return {
            downloadBlobs: function(A,B,C,D) {
                return;
            }
        }
    }
});

tr.run();
