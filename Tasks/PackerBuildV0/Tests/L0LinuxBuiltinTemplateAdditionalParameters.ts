import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const DefaultWorkingDirectory: string = "/a/w";

let taskPath = path.join(__dirname, '..', 'src', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('templateType', process.env["__template_type__"] || 'builtin');
tr.setInput('azureResourceGroup', 'testrg');
tr.setInput('storageAccountName', 'teststorage');
tr.setInput('baseImageSource', 'default');
tr.setInput('baseImage', 'Canonical:UbuntuServer:14.04.4-LTS:linux');
tr.setInput('location', 'South India');
tr.setInput('packagePath', 'dir1/**/dir2');
tr.setInput('deployScriptPath', 'dir3/**/deploy.sh');
tr.setInput('deployScriptArguments', "\"subdir 1\" false");
tr.setInput('ConnectedServiceName', 'AzureRMSpn');
tr.setInput('imageUri', 'imageUri');
tr.setInput('imageStorageAccount', 'imageStorageAccount');
tr.setInput("additionalBuilderParameters", "{\"ssh_pty\": \"true\", \"type\":\"amazonaws\"}");
tr.setInput("skipTempFileCleanupDuringVMDeprovision", "true");

process.env["ENDPOINT_URL_AzureRMSpn"] = "https://management.azure.com/";
process.env["ENDPOINT_AUTH_SCHEME_AzureRMSpn"] = "ServicePrincipal";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["ENDPOINT_DATA_AzureRMSpn_SPNOBJECTID"] =  "oId";
process.env["ENDPOINT_DATA_AzureRMSpn_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
process.env["ENDPOINT_DATA_AzureRMSpn_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://login.windows.net/";
process.env["ENDPOINT_DATA_AzureRMSpn_GRAPHURL"] = "https://graph.windows.net/";
process.env["RELEASE_RELEASENAME"] = "Release-1";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  DefaultWorkingDirectory;

// provide answers for task mock
let a: any = <any>{
    "which": {
        "packer": "packer"
    },
    "checkPath": {
        "packer": true,
        "/basedir/DefaultTemplates/default.linux.template.json": true,
        "/packer-user-scripts/deploy.sh": true
    },
    "exec": {
        "packer --version": {
            "code": 0,
            "stdout": "0.12.3"
        },
        "packer fix -validate=false /tmp/tempdir/100/default.linux.template-builderUpdated.json": {
            "code": 0,
            "stdout": "{ \"some-key\": \"some-value\" }"
        },
        "packer validate -var-file=/somefolder/somevarfile.json -var-file=/somefolder/somevarfile.json /tmp/tempdir/100/default.linux.template-builderUpdated-fixed.json": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "packer build -force -color=false -var-file=/somefolder/somevarfile.json -var-file=/somefolder/somevarfile.json /tmp/tempdir/100/default.linux.template-builderUpdated-fixed.json": {
            "code": process.env["__packer_build_fails__"] === "true" ? 1 : 0,
            "stdout": process.env["__packer_build_fails__"] === "true" ? "packer build failed\r\nsome error" : "Executed Successfully\nOSDiskUri: https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\nStorageAccountLocation: SouthIndia",
        },
        "packer fix -validate=false \\tmp\\tempdir\\100\\default.linux.template-builderUpdated.json": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "packer validate -var-file=/somefolder/somevarfile.json -var-file=/somefolder/somevarfile.json \\tmp\\tempdir\\100\\default.linux.template-builderUpdated-fixed.json": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "packer build -force -color=false -var-file=/somefolder/somevarfile.json -var-file=/somefolder/somevarfile.json \\tmp\\tempdir\\100\\default.linux.template-builderUpdated-fixed.json": {
            "code": process.env["__packer_build_fails__"] === "true" ? 1 : 0,
            "stdout": process.env["__packer_build_fails__"] === "true" ? "packer build failed\r\nsome error" : "Executed Successfully\nOSDiskUri: https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\nStorageAccountLocation: SouthIndia",
        }
    },
    "exist": {
        "/tmp/tempdir/100": true,
        "\\tmp\\tempdir\\100": true,
        "/tmp/tempdir/100/": true,
        "\\tmp\\tempdir\\100/": true,
        "packer": true
    },
    "rmRF": {
        "/tmp/tempdir/100": { 'success': true },
        "\\tmp\\tempdir\\100": { 'success': true }
    },
    "osType": {
        "osType": "Linux"
    }
};

var ut = require('../src/utilities');
var utMock = {
    IsNullOrEmpty : ut.IsNullOrEmpty,
    HasItems : ut.HasItems,
    StringWritable: ut.StringWritable,
    PackerVersion: ut.PackerVersion,
    isGreaterVersion: ut.isGreaterVersion,
    deleteDirectory: function(dir) {
        console.log("rmRF " + dir);
    },
    copyFile: function(source: string, destination: string) {
        console.log('copying ' + source + ' to ' + destination);
    },
    readJsonFile: function(filePath: string) {
        return "{\"builders\":[{\"type\":\"azure-arm\"}]}";
    },
    generateTemporaryFilePath: function () {
        return "/somefolder/somevarfile.json";
    },
    getPackerVarFileContent: function(variables) {
        return ut.getPackerVarFileContent(variables);
    },
    writeFile: function(filePath: string, content: string) {
        console.log("writing to file " + filePath + " content: " + content);
    },
    findMatch: function(root: string, patterns: string[] | string) {
        if(root === DefaultWorkingDirectory) {
            return ["/tmp/dir1/somedir/dir2"];
        } else {
            return ["/tmp/dir1/somedir/dir2/dir3/somedir/deploy.sh"];
        }
    },
    getCurrentTime: function() {
        return 100;
    },
    getTempDirectory: function() {
        return "/tmp/tempdir"
    },
    getCurrentDirectory: function() {
        return "/basedir/currdir";
    }
};

tr.registerMock('./utilities', utMock);
tr.registerMock('../utilities', utMock);

tr.setAnswers(a);
tr.run();
