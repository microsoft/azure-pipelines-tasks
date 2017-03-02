import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..\\src\\main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('ostype', process.env["__ostype__"] || 'windows');
tr.setInput('azureResourceGroup', 'testrg');
tr.setInput('azureStorageAccount', 'teststorage');
tr.setInput('imagePublisher', 'MicrosoftWindowsServer');
tr.setInput('imageOffer', 'MicrosoftWindowsServer');
tr.setInput('imageSku', '2012-R2-Datacenter');
tr.setInput('location', 'South India');
tr.setInput('packagePath', 'C:\\dummy.zip');
tr.setInput('deployScriptPath', 'C:\\deploy.ps1');
tr.setInput('ConnectedServiceName', 'AzureRMSpn');

process.env["ENDPOINT_AUTH_AzureRMSpn"] = "{\"parameters\":{\"serviceprincipalid\":\"spId\",\"serviceprincipalkey\":\"spKey\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["ENDPOINT_DATA_AzureRMSpn_SPNOBJECTID"] =  "oId";

// provide answers for task mock
let a: any = <any>{
    "which": {
        "packer": "packer"
    },
    "checkPath": {
        "packer": process.env["__packer_exists__"] === "false" ? false : true
    },
    "exec": {
        "packer fix -validate=false F:\\somedir\\tempdir\\100\\default.windows.template.json": {
            "code": process.env["__packer_fix_fails__"] === "true" ? 1 : 0,
            "stdout": process.env["__packer_fix_fails__"] === "true" ? "packer fix failed\r\nsome error" : "Executed Successfully",
        },
        "packer validate -var resource_group=testrg -var storage_account=teststorage -var image_publisher=MicrosoftWindowsServer -var image_offer=MicrosoftWindowsServer -var image_sku=2012-R2-Datacenter -var location=South India -var script_path=C:\\deploy.ps1 -var script_name=deploy.ps1 -var package_path=C:\\dummy.zip -var package_name=dummy.zip -var subscription_id=sId -var client_id=spId -var client_secret=spKey -var tenant_id=tenant -var object_id=oId F:\\somedir\\tempdir\\100\\default.windows.template.json": {
            "code": process.env["__packer_validate_fails__"] === "true" ? 1 : 0,
            "stdout": process.env["__packer_validate_fails__"] === "true" ? "packer validate failed\r\nsome error" : "Executed Successfully",
        },
        "packer build -force -var resource_group=testrg -var storage_account=teststorage -var image_publisher=MicrosoftWindowsServer -var image_offer=MicrosoftWindowsServer -var image_sku=2012-R2-Datacenter -var location=South India -var script_path=C:\\deploy.ps1 -var script_name=deploy.ps1 -var package_path=C:\\dummy.zip -var package_name=dummy.zip -var subscription_id=sId -var client_id=spId -var client_secret=spKey -var tenant_id=tenant -var object_id=oId F:\\somedir\\tempdir\\100\\default.windows.template.json": {
            "code": process.env["__packer_build_fails__"] === "true" ? 1 : 0,
            "stdout": process.env["__packer_build_fails__"] === "true" ? "packer build failed\r\nsome error" : (process.env["__packer_build_no_output__"] === "true" ? "Executed Successfully but output search will fail" : "Executed Successfully\nOSDiskUri: https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\nStorageAccountLocation: SouthIndia"),
        },
    }
};

var ut = require('../src/utilities');
tr.registerMock('./utilities', {
    IsNullOrEmpty : ut.IsNullOrEmpty,
    HasItems : ut.HasItems,
    StringWritable: ut.StringWritable,
    copyFile: function(source: string, destination: string) {
        if(process.env["__copy_fails__"] === "true") {
            throw "copy failed!!"
        } else {
            console.log('copying ' + source + ' to ' + destination);
        }
    },
    getCurrentTime: function() {
        return 100;
    },
    getTempDirectory: function() {
        return "F:\\somedir\\tempdir"
    }
}); 

tr.setAnswers(a);
tr.run();