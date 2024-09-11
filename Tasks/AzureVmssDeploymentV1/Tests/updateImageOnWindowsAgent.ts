import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as fs from 'fs';    
import * as sinon from 'sinon';    

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("action", "Update image");
tr.setInput("ConnectedServiceName", "AzureRM");
tr.setInput("vmssName", process.env["noMatchingVmss"] === "true" ? "random-vmss" : (process.env["_vmssOsType_"] === "Linux" ? "testvmss2" : "testvmss1"));
tr.setInput("vmssOsType", process.env["_vmssOsType_"] === "Linux" ? "Linux" : "Windows");
tr.setInput("imageUrl", process.env["imageUrlAlreadyUptoDate"] === "true" ? "http://old-url" : "https://someurl");
if (!(process.env["customScriptNotSpecified"] === "true")) {
    tr.setInput("customScriptsDirectory", "C:\\some\\dir with'quote");
    tr.setInput("customScript", process.env["_vmssOsType_"] === "Linux" ? "set V'a`r$.sh" : "de$p`l o'y.ps1");
    tr.setInput("customScriptArguments", "\"first 'arg'\" seco`nd$arg");
    tr.setInput("customScriptsStorageAccount", "teststorage1");
    tr.setInput("skipArchivingCustomScripts", process.env["_doNotArchive_"] === "true" ? "true" : "false");
}

process.env["AZURE_HTTP_USER_AGENT"] = "L0test";
process.env["ENDPOINT_AUTH_AzureRM"] = "{\"parameters\":{\"serviceprincipalid\":\"id\",\"serviceprincipalkey\":\"key\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID"] = "id";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY"] = "key";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID"] = "sId";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_URL_AzureRM"] = "https://management.azure.com/";
process.env["ENDPOINT_DATA_AzureRM_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
process.env["ENDPOINT_DATA_AzureRM_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://login.windows.net/";
process.env["RELEASE_RELEASEID"] = "100";
process.env["RELEASE_ENVIRONMENTID"] = "200";
process.env["RELEASE_ATTEMPTNUMBER"] = "5";
process.env["MOCK_NORMALIZE_SLASHES"] = "true";
console.log("inside updateimageonwindowsagent......");
console.log('MOCK_NORMALIZE_SLASHES:', process.env["MOCK_NORMALIZE_SLASHES"]);
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "findMatch": {
        "**/*.*": [
            "C:\\users\\temp\\vstsvmss12345\\folder1\\file1",
            "C:\\users\\temp\\vstsvmss12345\\folder1\\folder2\\file2",
            "C:\\users\\temp\\vstsvmss12345",
            "C:\\users\\temp\\vstsvmss12345\\cs.zip",
            "C:\\some\\dir"
        ]
    },
    "osType": {
        "osType": "Windows_NT"
    }
    
};
const mockStats: fs.Stats = {
    isFile: () => false,
    isDirectory: () => true,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    size: 0,
    blksize: 0,
    blocks: 0,
    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
    atime: new Date(),
    mtime: new Date(),
    ctime: new Date(),
    birthtime: new Date()
};


const existsSyncStub = sinon.stub(fs, 'existsSync').callsFake((p: string) => {
    //console.log("inside existsSyncStub......" + p);
    if (p === "C:\\users\\temp\\vstsvmss12345") {
        return true;  // Simulate that the directory exists
    }
    if (p === "C:\\some\\dir") {
        return true;  // Simulate that the directory exists
    }
    return fs.existsSync(p);  // Use the real fs.existsSync for other paths
});

const lstatSyncStub = sinon.stub(fs, 'lstatSync').callsFake((p: string) => {
    console.log("inside lstatSyncStub......" + p);
    if (p === "C:\\users\\temp\\vstsvmss12345") {
        return mockStats;  // Simulate that the directory exists
    }
    
    if (p === "C:\\some\\dir") {
        return mockStats;  // Simulate that the directory exists
    }
    return fs.lstatSync(p);  // Use the real fs.lstatSync for other paths
});



tr.setAnswers(a);

var os = require('os');
os.tmpdir = function tmpdir() {
    return "C:\\users\\temp";
}

Date.now = function (): number {
    return 12345;
}

tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
tr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-compute', require('./mock_node_modules/azure-arm-compute'));
tr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-storage', require('./mock_node_modules/azure-arm-storage'));
tr.registerMock('azp-tasks-az-blobstorage-provider/blobservice', require('./mock_node_modules/blobservice'));
tr.registerMock('azure-pipelines-tasks-utility-common/compressutility', require('./mock_node_modules/compressutility'));
tr.registerMock('BlobServiceClient', {
    getContainerClient: function(containerName: string) {
        console.log(`blobservice.getContainerClient is called with containername ${containerName}`);
        return {
            getBlockBlobClient: function(blobName: string) {
                console.log(`Mocked getBlockBlobClient called with blobName: ${blobName}`);
                return {
                    uploadFile: async function(filePath: string) {
                        console.log(`Mocked uploadFile called with filePath: ${filePath}`);
                        return {
                            _response: {
                                status: 201  // Simulate successful upload
                            }
                        };
                    }
                };
            }
        };
    }
});

tr.run();

existsSyncStub.restore();
lstatSyncStub.restore();