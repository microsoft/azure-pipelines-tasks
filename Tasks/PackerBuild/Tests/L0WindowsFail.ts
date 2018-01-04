import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

const DefaultWorkingDirectory: string = "C:\\a\\w\\";

let taskPath = path.join(__dirname, '..\\src\\main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('templateType', process.env["__template_type__"] || 'builtin');
tr.setInput('azureResourceGroup', 'testrg');
tr.setInput('storageAccountName', 'teststorage');
tr.setInput('baseImageSource', 'default');
tr.setInput('baseImage', !!process.env["__ostype__"] ? 'MicrosoftWindowsServer:WindowsServer:2012-R2-Datacenter:' + process.env["__ostype__"] : 'MicrosoftWindowsServer:WindowsServer:2012-R2-Datacenter:windows');
tr.setInput('location', 'South India');
tr.setInput('packagePath', 'dir1\\**\\dir2');
tr.setInput('deployScriptPath', 'dir3\\**\\deploy.ps1');
tr.setInput('ConnectedServiceName', 'AzureRMSpn');
if(!process.env["__no_output_vars__"] || process.env["__no_output_vars__"] !== "true") {
    tr.setInput('imageUri', 'imageUri');
    tr.setInput('imageStorageAccount', 'imageStorageAccount');
}
tr.setInput("additionalBuilderParameters", "{}");
tr.setInput("skipTempFileCleanupDuringVMDeprovision", "true");

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
        "packer": process.env["__packer_exists__"] === "false" ? false : true,
        "basedir\\DefaultTemplates\\default.windows.template.json": process.env["__copy_fails__"] === "true" ? false : true,
        "C:\\deploy.ps1": true
    },
    "exec": {
        "packer --version": {
            "code": 0,
            "stdout": "0.12.3"
        },
        "packer fix -validate=false F:\\somedir\\tempdir\\100\\default.windows.template.json": {
            "code": process.env["__packer_fix_fails__"] === "true" ? 1 : 0,
            "stdout": process.env["__packer_fix_fails__"] === "true" ? "packer fix failed\r\nsome error" : "{ \"some-key\": \"some-value\" }",
            "stderr": process.env["__packer_fix_fails__"] === "true" ? "packer fix failed\r\nsome error" : ""
        },
        "packer validate -var resource_group=testrg -var storage_account=teststorage -var image_publisher=MicrosoftWindowsServer -var image_offer=WindowsServer -var image_sku=2012-R2-Datacenter -var location=South India -var capture_name_prefix=Release-1 -var skip_clean=true -var script_relative_path=dir3\\somedir\\deploy.ps1 -var package_path=C:\\dir1\\somedir\\dir2 -var package_name=dir2 -var subscription_id=sId -var client_id=spId -var client_secret=spKey -var tenant_id=tenant -var object_id=oId F:\\somedir\\tempdir\\100\\default.windows.template-fixed.json": {
            "code": process.env["__packer_validate_fails__"] === "true" ? 1 : 0,
            "stdout": process.env["__packer_validate_fails__"] === "true" ? "packer validate failed\r\nsome error" : "Executed Successfully",
        },
        "packer build -force -var resource_group=testrg -var storage_account=teststorage -var image_publisher=MicrosoftWindowsServer -var image_offer=WindowsServer -var image_sku=2012-R2-Datacenter -var location=South India -var capture_name_prefix=Release-1 -var skip_clean=true -var script_relative_path=dir3\\somedir\\deploy.ps1 -var package_path=C:\\dir1\\somedir\\dir2 -var package_name=dir2 -var subscription_id=sId -var client_id=spId -var client_secret=spKey -var tenant_id=tenant -var object_id=oId F:\\somedir\\tempdir\\100\\default.windows.template-fixed.json": {
            "code": process.env["__packer_build_fails__"] === "true" ? 1 : 0,
            "stdout": process.env["__packer_build_fails__"] === "true" ? "packer build failed\r\nsome error" : (process.env["__packer_build_no_output__"] === "true" ? "Executed Successfully but output search will fail" : "Executed Successfully\nOSDiskUri: https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\nStorageAccountLocation: SouthIndia"),
        },
    },
    "exist": {
        "F:\\somedir\\tempdir\\100\\": true,
        "F:\\somedir\\tempdir\\100": true,
        "packer": process.env["__packer_exists__"] === "false" ? false : true
    },
    "rmRF": {
        "F:\\somedir\\tempdir\\100": { 'success': process.env["__cleanup_fails__"] === "true" ? false : true }
    },
    "osType": {
        "osType": "Windows_NT"
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
        console.log('copying ' + source + ' to ' + destination);
    },
    writeFile: function(filePath: string, content: string) {
        console.log("writing to file " + filePath + " content: " + content);
    },
    findMatch: function(root: string, patterns: string[] | string) {
        if(process.env["__deploy_package_found__"] === "false") {
            return [];
        } else {
            if(root === DefaultWorkingDirectory) {
                return ["C:\\dir1\\somedir\\dir2"];
            } else {
                return ["C:\\dir1\\somedir\\dir2\\dir3\\somedir\\deploy.ps1"];
            }
        }
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