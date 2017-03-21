import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..\\src\\main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('templateType', 'builtin');
tr.setInput('azureResourceGroup', 'testrg');
tr.setInput('storageAccountName', 'teststorage');
tr.setInput('baseImageSource', 'customVhd');
tr.setInput('customImageUrl', 'https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/vsts-buildimagetask/Release-1-osDisk.2d175222-b257-405f-a07f-0af4dc4b3dc4.vhd');
tr.setInput('customImageOSType', 'windows');
tr.setInput('location', 'South India');
tr.setInput('packagePath', '**/*.zip');
tr.setInput('deployScriptPath', 'C:\\deploy.ps1');
tr.setInput('deployScriptArguments', "-target \"subdir 1\" -shouldFail false");
tr.setInput('ConnectedServiceName', 'AzureRMSpn');
tr.setInput('imageUri', 'imageUri');
tr.setInput('imageStorageAccount', 'imageStorageAccount');

process.env["ENDPOINT_AUTH_AzureRMSpn"] = "{\"parameters\":{\"serviceprincipalid\":\"spId\",\"serviceprincipalkey\":\"spKey\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["ENDPOINT_DATA_AzureRMSpn_SPNOBJECTID"] =  "oId";
process.env["RELEASE_RELEASENAME"] = "Release-1";

// provide answers for task mock
let a: any = <any>{
    "which": {
        "packer": "packer"
    },
    "checkPath": {
        "packer": true,
        "basedir\\DefaultTemplates\\custom.windows.template.json": true,
        "C:\\deploy.ps1": true
    },
    "exec": {
        "packer --version": {
            "code": 0,
            "stdout": "0.12.3"
        },
        "packer fix -validate=false F:\\somedir\\tempdir\\100\\custom.windows.template.json": {
            "code": 0,
            "stdout": "{ \"some-key\": \"some-value\" }"
        },
        "packer validate -var resource_group=testrg -var storage_account=teststorage -var image_url=https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/vsts-buildimagetask/Release-1-osDisk.2d175222-b257-405f-a07f-0af4dc4b3dc4.vhd -var location=South India -var capture_name_prefix=Release-1 -var script_path=C:\\deploy.ps1 -var script_name=deploy.ps1 -var package_path=C:\\dummy.zip -var package_name=dummy.zip -var script_arguments=-target \"subdir 1\" -shouldFail false -var subscription_id=sId -var client_id=spId -var client_secret=spKey -var tenant_id=tenant -var object_id=oId F:\\somedir\\tempdir\\100\\custom.windows.template-fixed.json": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "packer build -force -var resource_group=testrg -var storage_account=teststorage -var image_url=https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/vsts-buildimagetask/Release-1-osDisk.2d175222-b257-405f-a07f-0af4dc4b3dc4.vhd -var location=South India -var capture_name_prefix=Release-1 -var script_path=C:\\deploy.ps1 -var script_name=deploy.ps1 -var package_path=C:\\dummy.zip -var package_name=dummy.zip -var script_arguments=-target \"subdir 1\" -shouldFail false -var subscription_id=sId -var client_id=spId -var client_secret=spKey -var tenant_id=tenant -var object_id=oId F:\\somedir\\tempdir\\100\\custom.windows.template-fixed.json": {
            "code": 0,
            "stdout": "Executed Successfully\nOSDiskUri: https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\nStorageAccountLocation: SouthIndia"
        }
    },
    "exist": {
        "F:\\somedir\\tempdir\\100": true,
        "F:\\somedir\\tempdir\\100\\": true,
        "packer": true       
    },
    "rmRF": {
        "F:\\somedir\\tempdir\\100": { 'success': true }
    }
};

var ut = require('../src/utilities');
tr.registerMock('./utilities', {
    IsNullOrEmpty : ut.IsNullOrEmpty,
    HasItems : ut.HasItems,
    StringWritable: ut.StringWritable,
    PackerVersion: ut.PackerVersion,
    isGreaterVersion: ut.isGreaterVersion,
    deleteDirectory: function(dir) {
        console.log("rmRF " + dir);
    },
    copyFile: function(source: string, destination: string) {
        if(process.env["__copy_fails__"] === "true") {
            throw "copy failed while copying from " + source;
        } else {
            console.log('copying ' + source + ' to ' + destination);
        }
    },
    writeFile: function(filePath: string, content: string) {
        console.log("writing to file " + filePath + " content: " + content);
    },
    findMatch: function(root: string, patterns: string[] | string) {
        return ["C:\\dummy.zip"];
    },
    getCurrentTime: function() {
        return 100;
    },
    getTempDirectory: function() {
        return "F:\\somedir\\tempdir"
    },
    getCurrentDirectory: function() {
        return "basedir\\currdir";
    }
}); 

tr.setAnswers(a);
tr.run();