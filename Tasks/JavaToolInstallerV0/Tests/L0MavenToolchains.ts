import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import msRestAzure = require('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common');
import path = require('path');
import os = require('os');
import mockTask = require('azure-pipelines-task-lib/mock-task');

const taskPath = path.join(__dirname, '..', 'javatoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const destDir = path.join(os.homedir(), '.m2');
const destFile = path.join(destDir, 'toolchains.xml');

tr.setInput("versionSpec", "8.1");
tr.setInput("jdkSource", "Azure Storage")
tr.setInput("artifactProvider", "azureStorage");
tr.setInput("azureResourceManagerEndpoint", "ARM1");
tr.setInput("azureStorageAccountName", "storage1");
tr.setInput("azureContainerName", "container1");
tr.setInput("azureCommonVirtualPath", "");
tr.setInput("fileType", ".tar.gz");
tr.setInput("destinationFolder", "javaJDK");
tr.setInput("cleanDestinationFolder", "false");
tr.setInput("createMavenToolchains", "true");

// provide answers for task mock
const a: mockanswer.TaskLibAnswers = <mockanswer.TaskLibAnswers>{
    exist: {[destDir]: true, [destFile]: true},
    find: {[destDir]: [destDir], [destFile]: [destFile]},
    rmRF: { },
    stats: {[destDir]: {'isDirectory':'true'}, [destFile]: {'isFile':'true'}},
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
