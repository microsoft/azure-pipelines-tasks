'use strict';

const assert = require('assert');
const ttm = require('vsts-task-lib/mock-test');
const tl = require('vsts-task-lib');
const path = require('path');

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

function runValidations(validator: () => void, tr, done) {
    try {
        validator();
        done();
    }
    catch (error) {
        console.log("STDERR", tr.stderr);
        console.log("STDOUT", tr.stdout);
        done(error);
    }
}

describe('Azure VMSS Deployment', function () {
    this.timeout(30000);
    before((done) => {
        done();
    });
    after(function () {
    });

    if (tl.osType().match(/^Win/)) {
        it("should succeed if vmss image updated successfully", (done) => {
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("Creating archive C:\\users\\temp\\vstsvmss12345\\cs.zip of compression type zip from C:\\some\\dir") > -1, "archive should be correctly created");
                assert(tr.stdout.indexOf("Invoker command: powershell ./100-12345/200/5/customScriptInvoker.ps1 -zipName 'cs.zip' -script '.\\\\\"\"\"de`$p``l o''y.ps1\"\"\"' -scriptArgs '\"\"\"first ''arg''\"\"\" seco``nd`$arg' -prefixPath '100-12345/200/5'") > -1, "invoker command should be correct");
                assert(tr.stdout.indexOf("storageAccounts.listKeys is called") > -1, "storage accounts should be listed");
                assert(tr.stdout.indexOf("blobService.uploadBlobs is called with source C:\\users\\temp\\vstsvmss12345 and dest vststasks") > -1, "scripts should be uploaded to correct account and container");
                assert(tr.stdout.indexOf("loc_mock_DestinationBlobContainer teststorage1.blob.core.windows.net/vststasks") > -1, "scripts should be uploaded to correct account and container");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called with resource testvmss1 and extension CustomScriptExtension1") > -1, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("custom script: teststorage1.blob.core.windows.net/vststasks/100-12345/200/5/folder1/file1") > -1, "vm extension should use correct file1");
                assert(tr.stdout.indexOf("custom script: teststorage1.blob.core.windows.net/vststasks/100-12345/200/5/folder1/folder2/file2") > -1, "vm extension should use correct file2");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_RemovingCustomScriptExtension") > -1, "removing old extension");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionRemoved") > -1, "old extension should be removed");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("should succeed if linux vmss image updated successfully", (done) => {
            process.env["_vmssOsType_"] = "Linux";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            delete process.env["_vmssOsType_"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("Creating archive C:\\users\\temp\\vstsvmss12345\\cs.tar.gz of compression type targz from C:\\some\\dir") > -1, "archive should be correctly created");
                assert(tr.stdout.indexOf("Invoker command: ./customScriptInvoker.sh 'cs.tar.gz' './\"set V'\"'\"'a\\\`r\\\$.sh\"' '\"first '\"'\"'arg'\"'\"'\" seco\\`nd\\$arg'") > -1, "invoker command should be correct");
                assert(tr.stdout.indexOf("blobService.uploadBlobs is called with source C:\\users\\temp\\vstsvmss12345 and dest vststasks") > -1, "scripts should be uploaded to correct account and container");
                assert(tr.stdout.indexOf("loc_mock_DestinationBlobContainer teststorage1.blob.core.windows.net/vststasks") > -1, "scripts should be uploaded to correct account and container");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called") == -1, "virtualMachineExtensions.deleteMethod function should not be called as no custom-script-linux extension is present");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss2 and extension CustomScriptExtension12345") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("custom script: teststorage1.blob.core.windows.net/vststasks/100-12345/200/5/folder1/file1") > -1, "vm extension should use correct file1");
                assert(tr.stdout.indexOf("custom script: teststorage1.blob.core.windows.net/vststasks/100-12345/200/5/folder1/folder2/file2") > -1, "vm extension should use correct file2");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg2, VMSS: testvmss2 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("should fail if failed to update VMSS image", (done) => {
            process.env["imageUpdateFailed"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["imageUpdateFailed"] = undefined;

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_VMSSImageUpdateFailed") > -1, "VMSS image update should fail");
            }, tr, done);
        });

        it("should fail if failed to list VMSSs", (done) => {
            process.env["vmssListFailed"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["vmssListFailed"] = undefined;

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") == -1, "virtualMachinesScaleSets.updateImage function should not be called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_VMSSListFetchFailed") > -1, "VMSS list should be failed");
            }, tr, done);
        });

        it("should fail if failed to get matching VMSS", (done) => {
            process.env["noMatchingVmss"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["noMatchingVmss"] = undefined;

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") == -1, "virtualMachinesScaleSets.updateImage function should not be called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_FailedToGetRGForVMSS") > -1, "VMSS list should be failed");
            }, tr, done);
        });

        it("should skip image update and update extension if image is already up-to-date", (done) => {
            process.env["imageUrlAlreadyUptoDate"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["imageUrlAlreadyUptoDate"] = undefined;

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") > -1, "virtualMachinesScaleSets.updateImage function should not be called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called with resource testvmss1 and extension CustomScriptExtension1") > -1, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("VMSSImageAlreadyUptoDate") > -1, "message should point out that image is already upto date");
            }, tr, done);
        });

        it("should succeed even if listing old extensions fails", (done) => {
            process.env["extensionListFailed"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["extensionListFailed"] = undefined;

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called with resource testvmss1 and extension CustomScriptExtension1") == -1, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_GetVMSSExtensionsListFailed") >= -1, "ahould warn about list failure");
                assert(tr.stdout.indexOf("loc_mock_RemovingCustomScriptExtension") == -1, "removing old extension");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionRemoved") == -1, "old extension should be removed");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("should succeed even if removing old extension fails", (done) => {
            process.env["extensionDeleteFailed"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["extensionDeleteFailed"] = undefined;

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called with resource testvmss1 and extension CustomScriptExtension1") > -1, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_RemoveVMSSExtensionsFailed") >= -1, "ahould warn about remove extension failure");
                assert(tr.stdout.indexOf("loc_mock_RemovingCustomScriptExtension") > -1, "removing old extension");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionRemoved") == -1, "old extension should be removed");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("should fail if installing extension fails", (done) => {
            process.env["extensionInstallFailed"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["extensionInstallFailed"] = undefined;

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") == -1, "virtualMachinesScaleSets.updateImage function should not have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") == -1, "new extension should not be installed");
                assert(tr.stdout.indexOf("loc_mock_SettingVMExtensionFailed") > -1, "new extension should not be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") == -1, "VMSS image should not be updated");
            }, tr, done);
        });

        it("should not remove extension if existing extensions are not custom script extension", (done) => {
            process.env["noExistingExtension"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["noExistingExtension"] = undefined;

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called with resource testvmss1 and extension CustomScriptExtension1") == -1, "virtualMachineExtensions.deleteMethod function should not have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_RemovingCustomScriptExtension") == -1, "removing old extension");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("should update image but skip installing extension if image custom script is not specified", (done) => {
            process.env["customScriptNotSpecified"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["customScriptNotSpecified"] = undefined;

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") > -1, "virtualMachinesScaleSets.updateImage function should not be called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") == -1, "virtualMachineExtensions.list function should not have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") == -1, "virtualMachineExtensions.createOrUpdate function should not have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "message should point out that image is already upto date");
            }, tr, done);
        });

        it("should use unarchived custom scripts if archiving fails", (done) => {
            process.env["_archivingFails_"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            delete process.env["_archivingFails_"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("Creating archive C:\\users\\temp\\vstsvmss12345\\cs.zip of compression type zip from C:\\some\\dir") > -1, "archive should be correctly created");
                assert(tr.stdout.indexOf("Invoker command: powershell ./100-12345/200/5/customScriptInvoker.ps1 -zipName '' -script '.\\\\\"\"\"de`$p``l o''y.ps1\"\"\"' -scriptArgs '\"\"\"first ''arg''\"\"\" seco``nd`$arg' -prefixPath '100-12345/200/5'") > -1, "invoker command should be correct");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptsArchivingFailed Error: Create archive failed with error - some error") > -1, "warning should be logged");
                assert(tr.stdout.indexOf("loc_mock_DestinationBlobContainer teststorage1.blob.core.windows.net/vststasks") > -1, "scripts should be uploaded to coorect account and container");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("should use unarchived custom scripts if skipArchivingCustomScripts input is true", (done) => {
            process.env["_doNotArchive_"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            delete process.env["_doNotArchive_"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("Creating archive C:\\users\\temp\\vstsvmss12345\\cs.zip of compression type zip from C:\\some\\dir with'quote") == -1, "archive should not be created");
                assert(tr.stdout.indexOf("Invoker command: powershell ./100-12345/200/5/customScriptInvoker.ps1 -zipName '' -script '.\\\\\"\"\"de`$p``l o''y.ps1\"\"\"' -scriptArgs '\"\"\"first ''arg''\"\"\" seco``nd`$arg' -prefixPath '100-12345/200/5'") > -1, "invoker command should be correct");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptsArchivingFailed Error: Create archive failed with error - some error") >= -1, "warning should be logged");
                assert(tr.stdout.indexOf("loc_mock_DestinationBlobContainer teststorage1.blob.core.windows.net/vststasks") > -1, "scripts should be uploaded to coorect account and container");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("should fail task if uploading custom scripts fails while listing keys", (done) => {
            process.env["_listAccessKeysFailed_"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            delete process.env["_listAccessKeysFailed_"];

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("Creating archive C:\\users\\temp\\vstsvmss12345\\cs.zip of compression type zip from C:\\some\\dir") > -1, "archive should be correctly created");
                assert(tr.stdout.indexOf("loc_mock_UploadingToStorageBlobsFailed You need permission to list keys") >= -1, "error should be logged");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") == -1, "new extension should not be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") == -1, "VMSS image should not be updated");
            }, tr, done);
        });

        it("should fail task if uploading custom scripts fails", (done) => {
            process.env["_uploadingFails_"] = "true";
            let tp = path.join(__dirname, "updateImageOnWindowsAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            delete process.env["_archivingFails_"];

            runValidations(() => {
                assert(tr.failed, "Should have succeeded");
                assert(tr.stdout.indexOf("Creating archive C:\\users\\temp\\vstsvmss12345\\cs.zip of compression type zip from C:\\some\\dir") > -1, "archive should be correctly created");
                assert(tr.stdout.indexOf("loc_mock_UploadingToStorageBlobsFailed Error while uploading blobs: some error") >= -1, "error should be logged");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") == -1, "new extension should not be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") == -1, "VMSS image should not be updated");
            }, tr, done);
        });
    } else {
        it("[nix] should succeed if vmss image updated successfully", (done) => {
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("Creating archive /users/temp/vstsvmss12345/cs.zip of compression type zip from /some/dir") > -1, "archive should be correctly created");
                assert(tr.stdout.indexOf("Invoker command: powershell ./100-12345/200/5/customScriptInvoker.ps1 -zipName 'cs.zip' -script '.\\\\\"\"\"de`$p``l o''y.ps1\"\"\"' -scriptArgs '\"\"\"first ''arg''\"\"\" seco``nd`$arg' -prefixPath '100-12345/200/5'") > -1, "invoker command should be correct");
                assert(tr.stdout.indexOf("storageAccounts.listKeys is called") > -1, "storage accounts should be listed");
                assert(tr.stdout.indexOf("blobService.uploadBlobs is called with source /users/temp/vstsvmss12345 and dest vststasks") > -1, "scripts should be uploaded to correct account and container");
                assert(tr.stdout.indexOf("loc_mock_DestinationBlobContainer teststorage1.blob.core.windows.net/vststasks") > -1, "scripts should be uploaded to correct account and container");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called with resource testvmss1 and extension CustomScriptExtension1") > -1, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("custom script: teststorage1.blob.core.windows.net/vststasks/100-12345/200/5/folder1/file1") > -1, "vm extension should use correct file1");
                assert(tr.stdout.indexOf("custom script: teststorage1.blob.core.windows.net/vststasks/100-12345/200/5/folder1/folder2/file2") > -1, "vm extension should use correct file2");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_RemovingCustomScriptExtension") > -1, "removing old extension");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionRemoved") > -1, "old extension should be removed");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("[nix] should succeed if linux vmss image updated successfully", (done) => {
            process.env["_vmssOsType_"] = "Linux";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            delete process.env["_vmssOsType_"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("Creating archive /users/temp/vstsvmss12345/cs.tar.gz of compression type targz from /some/dir") > -1, "archive should be correctly created");
                assert(tr.stdout.indexOf("Invoker command: ./customScriptInvoker.sh 'cs.tar.gz' './\"set V'\"'\"'a\\\`r\\\$.sh\"' '\"first '\"'\"'arg'\"'\"'\" seco\\`nd\\$arg'") > -1, "invoker command should be correct");
                assert(tr.stdout.indexOf("blobService.uploadBlobs is called with source /users/temp/vstsvmss12345 and dest vststasks") > -1, "scripts should be uploaded to correct account and container");
                assert(tr.stdout.indexOf("loc_mock_DestinationBlobContainer teststorage1.blob.core.windows.net/vststasks") > -1, "scripts should be uploaded to correct account and container");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called") == -1, "virtualMachineExtensions.deleteMethod function should not be called as no custom-script-linux extension is present");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss2 and extension CustomScriptExtension12345") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("custom script: teststorage1.blob.core.windows.net/vststasks/100-12345/200/5/folder1/file1") > -1, "vm extension should use correct file1");
                assert(tr.stdout.indexOf("custom script: teststorage1.blob.core.windows.net/vststasks/100-12345/200/5/folder1/folder2/file2") > -1, "vm extension should use correct file2");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg2, VMSS: testvmss2 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("[nix] should fail if failed to update VMSS image", (done) => {
            process.env["imageUpdateFailed"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["imageUpdateFailed"] = undefined;

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_VMSSImageUpdateFailed") > -1, "VMSS image update should fail");
            }, tr, done);
        });

        it("[nix] should fail if failed to list VMSSs", (done) => {
            process.env["vmssListFailed"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["vmssListFailed"] = undefined;

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") == -1, "virtualMachinesScaleSets.updateImage function should not be called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_VMSSListFetchFailed") > -1, "VMSS list should be failed");
            }, tr, done);
        });

        it("[nix] should fail if failed to get matching VMSS", (done) => {
            process.env["noMatchingVmss"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["noMatchingVmss"] = undefined;

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") == -1, "virtualMachinesScaleSets.updateImage function should not be called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_FailedToGetRGForVMSS") > -1, "VMSS list should be failed");
            }, tr, done);
        });

        it("[nix] should skip image update and update extension if image is already up-to-date", (done) => {
            process.env["imageUrlAlreadyUptoDate"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["imageUrlAlreadyUptoDate"] = undefined;

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") > -1, "virtualMachinesScaleSets.updateImage function should not be called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called with resource testvmss1 and extension CustomScriptExtension1") > -1, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("VMSSImageAlreadyUptoDate") > -1, "message should point out that image is already upto date");
            }, tr, done);
        });

        it("[nix] should succeed even if listing old extensions fails", (done) => {
            process.env["extensionListFailed"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["extensionListFailed"] = undefined;

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called with resource testvmss1 and extension CustomScriptExtension1") == -1, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_GetVMSSExtensionsListFailed") >= -1, "ahould warn about list failure");
                assert(tr.stdout.indexOf("loc_mock_RemovingCustomScriptExtension") == -1, "removing old extension");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionRemoved") == -1, "old extension should be removed");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("[nix] should succeed even if removing old extension fails", (done) => {
            process.env["extensionDeleteFailed"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["extensionDeleteFailed"] = undefined;

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called with resource testvmss1 and extension CustomScriptExtension1") > -1, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_RemoveVMSSExtensionsFailed") >= -1, "ahould warn about remove extension failure");
                assert(tr.stdout.indexOf("loc_mock_RemovingCustomScriptExtension") > -1, "removing old extension");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionRemoved") == -1, "old extension should be removed");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("[nix] should fail if installing extension fails", (done) => {
            process.env["extensionInstallFailed"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["extensionInstallFailed"] = undefined;

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") == -1, "virtualMachinesScaleSets.updateImage function should not have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") == -1, "new extension should not be installed");
                assert(tr.stdout.indexOf("loc_mock_SettingVMExtensionFailed") > -1, "new extension should not be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") == -1, "VMSS image should not be updated");
            }, tr, done);
        });

        it("[nix] should not remove extension if existing extensions are not custom script extension", (done) => {
            process.env["noExistingExtension"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["noExistingExtension"] = undefined;

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > -1, "virtualMachineExtensions.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called with resource testvmss1 and extension CustomScriptExtension1") == -1, "virtualMachineExtensions.deleteMethod function should not have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") > -1, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_RemovingCustomScriptExtension") == -1, "removing old extension");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("[nix] should update image but skip installing extension if image custom script is not specified", (done) => {
            process.env["customScriptNotSpecified"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            process.env["customScriptNotSpecified"] = undefined;

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") > -1, "virtualMachinesScaleSets.updateImage function should not be called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") == -1, "virtualMachineExtensions.list function should not have been called from azure-sdk");
                assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called with resource testvmss1 and extension CustomScriptExtension") == -1, "virtualMachineExtensions.createOrUpdate function should not have been called from azure-sdk");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "message should point out that image is already upto date");
            }, tr, done);
        });

        it("[nix] should use unarchived custom scripts if archiving fails", (done) => {
            process.env["_archivingFails_"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            delete process.env["_archivingFails_"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("Creating archive /users/temp/vstsvmss12345/cs.zip of compression type zip from /some/dir") > -1, "archive should be correctly created");
                assert(tr.stdout.indexOf("Invoker command: powershell ./100-12345/200/5/customScriptInvoker.ps1 -zipName '' -script '.\\\\\"\"\"de`$p``l o''y.ps1\"\"\"' -scriptArgs '\"\"\"first ''arg''\"\"\" seco``nd`$arg' -prefixPath '100-12345/200/5'") > -1, "invoker command should be correct");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptsArchivingFailed Error: Create archive failed with error - some error") >= -1, "warning should be logged");
                assert(tr.stdout.indexOf("loc_mock_DestinationBlobContainer teststorage1.blob.core.windows.net/vststasks") > -1, "scripts should be uploaded to coorect account and container");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("[nix] should use unarchived custom scripts if skipArchivingCustomScripts input is true", (done) => {
            process.env["_doNotArchive_"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            delete process.env["_doNotArchive_"];

            runValidations(() => {
                assert(tr.succeeded, "Should have succeeded");
                assert(tr.stdout.indexOf("Creating archive C:\\users\\temp\\vstsvmss12345\\cs.zip of compression type zip from C:\\some\\dir with'quote") == -1, "archive should not be created");
                assert(tr.stdout.indexOf("Invoker command: powershell ./100-12345/200/5/customScriptInvoker.ps1 -zipName '' -script '.\\\\\"\"\"de`$p``l o''y.ps1\"\"\"' -scriptArgs '\"\"\"first ''arg''\"\"\" seco``nd`$arg' -prefixPath '100-12345/200/5'") > -1, "invoker command should be correct");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptsArchivingFailed Error: Create archive failed with error - some error") >= -1, "warning should be logged");
                assert(tr.stdout.indexOf("loc_mock_DestinationBlobContainer teststorage1.blob.core.windows.net/vststasks") > -1, "scripts should be uploaded to coorect account and container");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") > -1, "new extension should be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
            }, tr, done);
        });

        it("[nix] should fail task if uploading custom scripts fails", (done) => {
            process.env["_listAccessKeysFailed_"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            delete process.env["_listAccessKeysFailed_"];

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("Creating archive /users/temp/vstsvmss12345/cs.zip of compression type zip from /some/dir") > -1, "archive should be correctly created");
                assert(tr.stdout.indexOf("loc_mock_UploadingToStorageBlobsFailed You need permission to list keys") >= -1, "error should be logged");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") == -1, "new extension should not be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") == -1, "VMSS image should not be updated");
            }, tr, done);
        });

        it("[nix] should fail task if uploading custom scripts fails", (done) => {
            process.env["_uploadingFails_"] = "true";
            let tp = path.join(__dirname, "updateImageOnLinuxAgent.js");
            let tr = new ttm.MockTestRunner(tp);
            tr.run();
            delete process.env["_archivingFails_"];

            runValidations(() => {
                assert(tr.failed, "Should have failed");
                assert(tr.stdout.indexOf("Creating archive /users/temp/vstsvmss12345/cs.zip of compression type zip from /some/dir") > -1, "archive should be correctly created");
                assert(tr.stdout.indexOf("loc_mock_UploadingToStorageBlobsFailed Error while uploading blobs: some error") >= -1, "error should be logged");
                assert(tr.stdout.indexOf("loc_mock_CustomScriptExtensionInstalled") == -1, "new extension should not be installed");
                assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") == -1, "VMSS image should not be updated");
            }, tr, done);
        });
    }
});
