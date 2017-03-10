import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..\\src\\main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('azureResourceGroup', 'testrg');
tr.setInput('azureStorageAccount', 'teststorage');
tr.setInput('baseImage', 'Canonical:UbuntuServer:14.04.4-LTS:linux');
tr.setInput('location', 'South India');
tr.setInput('packagePath', '/packer-user-scripts/dummy.tar.gz');
tr.setInput('deployScriptPath', '/packer-user-scripts/deploy.sh');
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
        "basedir\\DefaultTemplates\\default.linux.template.json": true
    },
    "exec": {
        "packer fix -validate=false /tmp/tempdir/100/default.linux.template.json": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "packer validate -var resource_group=testrg -var storage_account=teststorage -var image_publisher=Canonical -var image_offer=UbuntuServer -var image_sku=14.04.4-LTS -var location=South India -var capture_name_prefix=Release-1 -var script_path=/packer-user-scripts/deploy.sh -var script_name=deploy.sh -var package_path=/packer-user-scripts/dummy.tar.gz -var package_name=dummy.tar.gz -var subscription_id=sId -var client_id=spId -var client_secret=spKey -var tenant_id=tenant -var object_id=oId /tmp/tempdir/100/default.linux.template.json": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "packer build -force -var resource_group=testrg -var storage_account=teststorage -var image_publisher=Canonical -var image_offer=UbuntuServer -var image_sku=14.04.4-LTS -var location=South India -var capture_name_prefix=Release-1 -var script_path=/packer-user-scripts/deploy.sh -var script_name=deploy.sh -var package_path=/packer-user-scripts/dummy.tar.gz -var package_name=dummy.tar.gz -var subscription_id=sId -var client_id=spId -var client_secret=spKey -var tenant_id=tenant -var object_id=oId /tmp/tempdir/100/default.linux.template.json": {
            "code": 0,
            "stdout": "Executed Successfully\nOSDiskUri: https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\nStorageAccountLocation: SouthIndia"
        },
        "packer fix -validate=false \\tmp\\tempdir\\100\\default.linux.template.json": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "packer validate -var resource_group=testrg -var storage_account=teststorage -var image_publisher=Canonical -var image_offer=UbuntuServer -var image_sku=14.04.4-LTS -var location=South India -var capture_name_prefix=Release-1 -var script_path=/packer-user-scripts/deploy.sh -var script_name=deploy.sh -var package_path=/packer-user-scripts/dummy.tar.gz -var package_name=dummy.tar.gz -var subscription_id=sId -var client_id=spId -var client_secret=spKey -var tenant_id=tenant -var object_id=oId \\tmp\\tempdir\\100\\default.linux.template.json": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "packer build -force -var resource_group=testrg -var storage_account=teststorage -var image_publisher=Canonical -var image_offer=UbuntuServer -var image_sku=14.04.4-LTS -var location=South India -var capture_name_prefix=Release-1 -var script_path=/packer-user-scripts/deploy.sh -var script_name=deploy.sh -var package_path=/packer-user-scripts/dummy.tar.gz -var package_name=dummy.tar.gz -var subscription_id=sId -var client_id=spId -var client_secret=spKey -var tenant_id=tenant -var object_id=oId \\tmp\\tempdir\\100\\default.linux.template.json": {
            "code": 0,
            "stdout": "Executed Successfully\nOSDiskUri: https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\nStorageAccountLocation: SouthIndia"
        }
    },
    "exist": {
        "/tmp/tempdir/100": true,
        "\\tmp\\tempdir\\100": true,
        "/tmp/tempdir/100/": true,
        "\\tmp\\tempdir\\100/": true
    },
    "rmRF": {
        "/tmp/tempdir/100": { 'success': true },
        "\\tmp\\tempdir\\100": { 'success': true }
    }
};

var ut = require('../src/utilities');
tr.registerMock('./utilities', {
    IsNullOrEmpty : ut.IsNullOrEmpty,
    HasItems : ut.HasItems,
    StringWritable: ut.StringWritable,
    copyFile: function(source: string, destination: string) {
        console.log('copying ' + source + ' to ' + destination);
    },
    getCurrentTime: function() {
        return 100;
    },
    getTempDirectory: function() {
        return "/tmp/tempdir"
    },
    getCurrentDirectory: function() {
        return "basedir\\currdir";
    }
});

tr.setAnswers(a);
tr.run();