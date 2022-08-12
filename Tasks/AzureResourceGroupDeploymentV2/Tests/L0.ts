'use strict';

const assert = require('assert');
const ttm = require('azure-pipelines-task-lib/mock-test');
const path = require('path');

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Azure Resource Group Deployment', function () {
    this.timeout(90000);
    before((done) => {
        done();
    });
    after(function () {
    });

    process.env['AGENT_HOMEDIRECTORY'] = process.env['AGENT_HOMEDIRECTORY'] || "C:\\temp\\agent\\home";
	process.env['BUILD_SOURCESDIRECTORY'] = process.env['BUILD_SOURCESDIRECTORY'] || "C:\\temp\\agent\\home\\sources",
	process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] || "C:\\temp\\agent\\home";
	process.env["AGENT_TEMPDIRECTORY"] = process.env["AGENT_TEMPDIRECTORY"] || process.env["RUNNER_TEMP"] || process.env["TMP"] || "C:\\temp\\agent\\home\\temp";

// uncomment to get test traces
//	process.env['TASK_TEST_TRACE'] = "1";

    it("Successfully added Azure Pipelines Agent Extension on VM when option specified - Create or update RG", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Create Or Update Resource Group";
        process.env["resourceGroupName"] = "dummy";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMWithDGAgent";
        process.env["copyAzureVMTags"] = "true";
        process.env["outputVariable"] = "";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "virtualMachineExtensions.createOrUpdate  function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentAddedOnAllVMs") > 0, "Deployment group agent should have been added on all VMs");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("DGAgentHandlerMajorVersion") > 0, "Since agent major version has been upgraded, modify the task version and also in the loc string; both are in task.json.");
            assert(tr.stdout.indexOf("Copying VM tags") > 0, "Tags should be copied");
            assert(tr.stdout.indexOf("loc_mock_AddExtension") > 0, "TeamServicesAgent should have been added on the VM");
            assert(tr.stdout.indexOf("loc_mock_AddingExtensionSucceeded") > 0, "TeamServicesAgent should have been added on the VM");
            assert(tr.stdout.indexOf("loc_mock_VMDetailsFetchSucceeded") > 0, "VM details should have been fetched");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Task fails when incorrect PAT token endpoint is given - Create or update RG", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Create Or Update Resource Group";
        process.env["resourceGroupName"] = "IncorrectPat";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMWithDGAgent";
        process.env["copyAzureVMTags"] = "true";
        process.env["outputVariable"] = "";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "virtualMachineExtensions.createOrUpdate  function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_AddExtension") > 0, "TeamServicesAgent should have been tried to be added on the VM");
            assert(tr.stdout.indexOf("loc_mock_AddingExtensionSucceeded") <= 0, "TeamServicesAgent should not have been added on the VM");
            assert(tr.stdout.indexOf("loc_mock_DeleteExtension") > 0, "TeamServicesAgent should have been tried to be deleted from the VM, since the installation failed");
            assert(tr.stdout.indexOf("loc_mock_DeletionSucceeded") > 0, "TeamServicesAgent should have been deleted successfully");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Task fails when PAT service endpoint not of type Token is given  - Create or update RG", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Create Or Update Resource Group";
        process.env["resourceGroupName"] = "dummy";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMWithDGAgent";
        process.env["copyAzureVMTags"] = "true";
        process.env["outputVariable"] = "";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Basic\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("loc_mock_OnlyTokenAuthAllowed") > 0, "TeamServicesAgent should not have been added on the VM");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Successfully removed failed extensions - Create or update RG", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Create Or Update Resource Group";
        process.env["resourceGroupName"] = "dummy_ProvisioningOfDeploymentGroupExtensionFailed";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMWithDGAgent";
        process.env["copyAzureVMTags"] = "true";
        process.env["outputVariable"] = "";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "virtualMachineExtensions.createOrUpdate  function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_AddExtension") > 0, "TeamServicesAgent should have been tried to be added on the VM");
            assert(tr.stdout.indexOf("loc_mock_AddingExtensionSucceeded") <= 0, "TeamServicesAgent should not have been added on the VM");
            assert(tr.stdout.indexOf("loc_mock_DeleteExtension") > 0, "TeamServicesAgent should have been tried to be deleted from the VM, since the installation failed");
            assert(tr.stdout.indexOf("loc_mock_DeletionSucceeded") > 0, "TeamServicesAgent should have been deleted successfully");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Did not add extensions if no vms present", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Create Or Update Resource Group";
        process.env["resourceGroupName"] = "noVMs";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMWithDGAgent";
        process.env["copyAzureVMTags"] = "true";
        process.env["outputVariable"] = "";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "virtualMachineExtensions.createOrUpdate  function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentAddedOnAllVMs") <= 0, "Deployment group agent should not have been added since there are no VMs");
            assert(tr.stdout.indexOf("Copying VM tags") <= 0, "Tags should not be copied since there are no VMs");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_AddExtension") <= 0, "TeamServicesAgent should not have been added since there are no VMs");
            assert(tr.stdout.indexOf("loc_mock_AddingExtensionSucceeded") <= 0, "TeamServicesAgent should not have been added since there are no VMs");
            assert(tr.stdout.indexOf("loc_mock_VMDetailsFetchSucceeded") <= 0, "VM details should not have been fetched since there are no VMs");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Started stopped vm and installed extension", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Create Or Update Resource Group";
        process.env["resourceGroupName"] = "StoppedVM";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMWithDGAgent";
        process.env["copyAzureVMTags"] = "true";
        process.env["outputVariable"] = "";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "virtualMachineExtensions.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentAddedOnAllVMs") > 0, "Deployment group agent should have been added on all vms");
            assert(tr.stdout.indexOf("Copying VM tags") > 0, "Tags should be copied ");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_AddExtension") > 0, "TeamServicesAgent should have been added");
            assert(tr.stdout.indexOf("loc_mock_AddingExtensionSucceeded") > 0, "TeamServicesAgent should have been added");
            assert(tr.stdout.indexOf("loc_mock_VMDetailsFetchSucceeded") > 0, "VM details should have been fetched");
            assert(tr.stdout.indexOf("VMStartFailed") <= 0, "");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Task Failed when a vm was transitioning", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Create Or Update Resource Group";
        process.env["resourceGroupName"] = "TransitioningVM";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMWithDGAgent";
        process.env["copyAzureVMTags"] = "true";
        process.env["outputVariable"] = "";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "virtualMachineExtensions.createOrUpdate function should not have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentAddedOnAllVMs") <= 0, "Deployment group agent should not have been added on all vms");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_VMTransitioningSkipExtensionAddition") > 0, "VM is transitionin. Adding extension should be skipped and task aborted.");
            assert(tr.stdout.indexOf("loc_mock_AddingExtensionSucceeded") < 0, "TeamServicesAgent should not have been added on the VM. Task is supposed to abort before that.");
            assert(tr.stdout.indexOf("loc_mock_VMDetailsFetchSucceeded") > 0, "VM details should have been fetched");
            assert(tr.stdout.indexOf("VMStartFailed") <= 0, "");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Tags not copied when option not checked", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Create Or Update Resource Group";
        process.env["resourceGroupName"] = "dummy";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMWithDGAgent";
        process.env["copyAzureVMTags"] = "false";
        process.env["outputVariable"] = "";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "virtualMachineExtensions.createOrUpdate  function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentAddedOnAllVMs") > 0, "Deployment group agent should have been added on all VMs");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("Copying VM tags") <= 0, "Tags should not be copied because option is not checked");
            assert(tr.stdout.indexOf("loc_mock_AddExtension") > 0, "TeamServicesAgent should have been added on the VM");
            assert(tr.stdout.indexOf("loc_mock_AddingExtensionSucceeded") > 0, "TeamServicesAgent should have been added on the VM");
            assert(tr.stdout.indexOf("loc_mock_VMDetailsFetchSucceeded") > 0, "VM details should have been fetched");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Successfully added Azure Pipelines Agent Extension on VM - Select RG", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Select Resource Group";
        process.env["resourceGroupName"] = "dummy";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMWithDGAgent";
        process.env["copyAzureVMTags"] = "true";
        process.env["outputVariable"] = "a";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "virtualMachineExtensions.createOrUpdate  function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentAddedOnAllVMs") > 0, "Deployment group agent should have been added on all VMs");
            assert(tr.stdout.indexOf("loc_mock_AddExtension") > 0, "TeamServicesAgent should have been added on the VM");
            assert(tr.stdout.indexOf("loc_mock_AddingExtensionSucceeded") > 0, "TeamServicesAgent should have been added on the VM");
            assert(tr.stdout.indexOf("loc_mock_VMDetailsFetchSucceeded") > 0, "VM details should have been fetched");
            assert(tr.stdout.indexOf("Copying VM tags") > 0, "Tags should be copied");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Successfully added Azure Pipelines Agent Linux Extension on Linux VM", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Create Or Update Resource Group";
        process.env["resourceGroupName"] = "NonWindowsVM";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMWithDGAgent";
        process.env["copyAzureVMTags"] = "true";
        process.env["outputVariable"] = "";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "virtualMachineExtensions.createOrUpdate  function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentAddedOnAllVMs") > 0, "Deployment group agent should have been added on all VMs");
            assert(tr.stdout.indexOf("Copying VM tags") > 0, "Tags should be copied");
            assert(tr.stdout.indexOf("loc_mock_AddExtension") > 0, "TeamServicesAgent should have been added on the VM");
            assert(tr.stdout.indexOf("loc_mock_AddingExtensionSucceeded") > 0, "TeamServicesAgent should have been added on the VM");
            assert(tr.stdout.indexOf("loc_mock_VMDetailsFetchSucceeded") > 0, "VM details should have been fetched");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Did not add Azure Pipelines Agent Extension on VM when option not specified", (done) => {
        let tp = path.join(__dirname, "addVSTSExtension.js");
        process.env["action"] = "Create Or Update Resource Group";
        process.env["resourceGroupName"] = "dummy";
        process.env["enableDeploymentPrerequisites"] = "ConfigureVMwithWinRM";
        process.env["copyAzureVMTags"] = "true";
        process.env["outputVariable"] = "";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_DGAgentAddedOnAllVMs") <= 0, "Deployment group agent should not have been added on all VMs");
            assert(tr.stdout.indexOf("Copying VM tags") <= 0, "Tags should not be copied");
            assert(tr.stdout.indexOf("loc_mock_AddingExtensionSucceeded") <= 0, "TeamServicesAgent should not have been added on the VM, since option was not specified");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Successfully deleted Azure Pipelines Agent Extension on VM - Delete VMs", (done) => {
        let tp = path.join(__dirname, "deleteVSTSExtension.js");
        process.env["action"] = "Delete";
        process.env["resourceGroupName"] = "NonWindowsVM";
        process.env["outputVariable"] = "";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called") > 0, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("virtualMachines.deleteMethod is called") > 0, "Should have deleted VM");
            assert(tr.stdout.indexOf("loc_mock_DeleteExtension") > 0, "Deployment group agent should have been tried to be deleted from VM");
            assert(tr.stdout.indexOf("loc_mock_DeletionSucceeded") > 0, "Deployment group agent should have been deleted from VM");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Successfully deleted Azure Pipelines Agent Extension on VM - Delete RG", (done) => {
        let tp = path.join(__dirname, "deleteVSTSExtension.js");
        process.env["action"] = "DeleteRG";
        process.env["resourceGroupName"] = "NonWindowsVM";
        process.env["outputVariable"] = "";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called") > 0, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentDeletedFromAllVMs") > 0, "Deployment group agent should have been deleted from all VMs");
            assert(tr.stdout.indexOf("resourceGroup.deleteMethod is called") > 0, "Task should have called resourceGroup.deleteMethod function from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DeleteExtension") > 0, "Deployment group agent should have started to be deleted from VM");
            assert(tr.stdout.indexOf("loc_mock_DeletionSucceeded") > 0, "Deployment group agent should have been deleted from VM");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Did not delete extensions if no vms present - Delete VMs", (done) => {
        let tp = path.join(__dirname, "deleteVSTSExtension.js");
        process.env["action"] = "Delete";
        process.env["resourceGroupName"] = "noVMs";
        process.env["outputVariable"] = "";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called") <= 0, "virtualMachineExtensions.deleteMethod function should not have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentDeletedFromAllVMs") <= 0, "Deployment group agent should not have been deleted since there are no VMs");
            assert(tr.stdout.indexOf("loc_mock_VM_Delete") <= 0, "Should not have deleted VM since no vms present");
            assert(tr.stdout.indexOf("loc_mock_DeleteExtension") <= 0, "Should not have tried to deleted extension since no vms are present");
            assert(tr.stdout.indexOf("virtualMachines.deleteMethod is called") <= 0, "Should not have called virtualMachines.deleteMethod function from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Did not delete extensions on stopped vm but vm got deleted- Delete VMs", (done) => {
        let tp = path.join(__dirname, "deleteVSTSExtension.js");
        process.env["action"] = "Delete";
        process.env["resourceGroupName"] = "StoppedVM";
        process.env["outputVariable"] = "";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called") > 0, "virtualMachineExtensions.deleteMethod function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentDeletedFromAllVMs") <= 0, "Deployment group agent should not have been deleted from all VMs");
            assert(tr.stdout.indexOf("loc_mock_VM_Delete") > 0, "Should have deleted VM");
            assert(tr.stdout.indexOf("loc_mock_DeleteExtension") > 0, "Should have tried to deleted extension");
            assert(tr.stdout.indexOf("loc_mock_DeleteAgentManually") > 0, "Deletion warning should have been prompted");
            assert(tr.stdout.indexOf("virtualMachines.deleteMethod is called") > 0, "Should have called virtualMachines.deleteMethod function from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Did not delete extensions if no vms present - Delete RG", (done) => {
        let tp = path.join(__dirname, "deleteVSTSExtension.js");
        process.env["action"] = "DeleteRG";
        process.env["resourceGroupName"] = "noVMs";
        process.env["outputVariable"] = "";
        process.env["ENDPOINT_AUTH_PatEndpoint"] = "{\"parameters\":{\"apitoken\":\"PAT\"},\"scheme\":\"Token\"}";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called") <= 0, "virtualMachineExtensions.deleteMethod function should not have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_DGAgentDeletedFromAllVMs") <= 0, "Deployment group agent should not have been deleted since there are not vms");
            assert(tr.stdout.indexOf("loc_mock_DeleteExtension") <= 0, "Should not have tried to deleted extension since no vms are present");
            assert(tr.stdout.indexOf("resourceGroup.deleteMethod is called") > 0, "Delete Resource Group function should have been called");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Successfully triggered createOrUpdate deployment', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("set ") < 0, "deploymentsOutput should not have been updated");
            assert(tr.stdout.indexOf("properly sanitized") > 0, "Parameters should have been sanitized");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Successfully triggered createOrUpdate deployment and updated deploymentOutputs', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("properly sanitized") > 0, "Parameters should have been sanitized");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Create or Update RG, failed on faulty CSM template file', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "faultyCSM.json";
        process.env["csmParametersFile"] = "faultyCSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.failed, "Task should have failed");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") == -1, "Task should have failed before calling deployments.createOrUpdate function from azure-sdk");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
        done();
    });
    it('Create or Update RG, succeeded on CSM template file with comments', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithComments.json";
        process.env["csmParametersFile"] = "CSMwithComments.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Selected Resource Group successfully', (done) => {
        let tp = path.join(__dirname, 'selectResourceGroup.js');
        process.env["outputVariable"] = "output.variable.custom";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("set output.variable.custom") >= 0, "Should have written to the output variable.");
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "Should have called networkInterfaces.list from azure-sdk");
            assert(tr.stdout.indexOf("publicIPAddresses.list is called") > 0, "Should have called publicIPAddresses.list from azure-sdk");
            assert(tr.stdout.indexOf("virtualMachines.list is called") > 0, "Should have called virtualMachines.list from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Selected Resource Group successfully in Azure Stack environment', (done) => {
        let tp = path.join(__dirname, 'selectResourceGroup.js');
        process.env["outputVariable"] = "output.variable.custom";
        process.env["ENDPOINT_DATA_AzureRM_ENVIRONMENT"] = "AzureStack";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("set output.variable.custom") >= 0, "Should have written to the output variable.");
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "Should have called networkInterfaces.list from azure-sdk");
            assert(tr.stdout.indexOf("publicIPAddresses.list is called") > 0, "Should have called publicIPAddresses.list from azure-sdk");
            assert(tr.stdout.indexOf("virtualMachines.list is called") > 0, "Should have called virtualMachines.list from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        } finally {
            delete process.env.ENDPOINT_DATA_AzureRM_ENVIRONMENT
        }
    });
    it('Select Resource Group failed on empty output Variable', (done) => {
        let tp = path.join(__dirname, 'selectResourceGroup.js');
        process.env["outputVariable"] = "";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.failed, "Task should have failed");
            assert(tr.stdout.indexOf("loc_mock_OutputVariableShouldNotBeEmpty") > 0, "Should have logged the output variable requirement.");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    /* Disabled due to intermittently failing (timing out) during CI:
            Azure Resource Group Deployment Deleted Resource Group:
            Error: timeout of 30000ms exceeded. Ensure the done() callback is being called in this test.

    it("Deleted Resource Group", (done) => {
        let tp = path.join(__dirname, 'deleteResourceGroup.js');
        process.env["outputVariable"] = null;
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_DeletingResourceGroup") > 0, "Delete Resource Group function should have been called");
            assert(tr.stdout.indexOf("resourceGroup.deleteMethod is called") > 0, "Task should have called resourceGroup.deleteMethod function from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    */
    it('Started VMs', (done) => {
        let tp = path.join(__dirname, 'VMOperations.js');
        process.env["operation"] = "Start";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_VM_Start") > 0, "Should have started VM");
            assert(tr.stdout.indexOf("virtualMachines.start is called") > 0, "Should have called virtualMachines.start function from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Stopped VMs', (done) => {
        let tp = path.join(__dirname, 'VMOperations.js');
        process.env["operation"] = "Stop";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_VM_Stop") > 0, "Should have stopped VM");
            assert(tr.stdout.indexOf("virtualMachines.powerOff is called") > 0, "Should have called virtualMachines.powerOff function from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Stopped VMs with deallocating', (done) => {
        let tp = path.join(__dirname, 'VMOperations.js');
        process.env["operation"] = "StopWithDeallocate";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_VM_Deallocate") > 0, "Should have deallocated VM");
            assert(tr.stdout.indexOf("virtualMachines.deallocate is called") > 0, "Should have called virtualMachines.deallocate function from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Restarted VMs', (done) => {
        let tp = path.join(__dirname, 'VMOperations.js');
        process.env["operation"] = "Restart";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_VM_Restart") > 0, "Should have started VM");
            assert(tr.stdout.indexOf("virtualMachines.restart is called") > 0, "Should have called virtualMachines.restart function from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Deleted VMs', (done) => {
        let tp = path.join(__dirname, 'VMOperations.js');
        process.env["operation"] = "Delete";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_VM_Delete") > 0, "Should have started VM");
            assert(tr.stdout.indexOf("virtualMachines.deleteMethod is called") > 0, "Should have called virtualMachines.deleteMethod function from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Vms doesnot have windows VM', (done) => {
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "NonWindowsVM";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("Enabling winrm for virtual machine") <= 0, "Should not enable winrm if the Operating System is not windows");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('No LB present, Vm Doesnot contain Custom Script Extension, Vm has no NSG', (done) => {
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionNotPresent";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rule for the LB");
            assert(tr.stdout.indexOf("Enabling winrm for virtual machine") > 0, "Should add Custom Script Extension to the virual machine");
            assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > 0, "Should try getting the extension on the virtual machine");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should call createOrUpdate of virtual Machine extensions");
            assert(tr.stdout.indexOf("Addition of extension completed for vm: customVM") > 0, "Should be able to add the extension");
            assert(tr.stdout.indexOf("Provisioning of CustomScriptExtension on vm customVM is in Succeeded State") > 0, "Provisioning of the Custom Script Extension should be in succeeded state");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('1 LB 1 VM present, No Inbound Nat Rule Present', (done) => {
        // VM has WinRMHttps Listener enabled, but no NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "OneLBOneVM";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not try adding custom Script Extension as winrmHttps Listener is already enabled");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    //Assertion check
    it('1 LB 2 Vms present, No Inbound Nat Rules Present', (done) => {
        // VM has WinRMHttps Listener enabled, but no NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "OneLBTwoVMs";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not enable winrm as it is already present");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('1 LB 1 VM present, Inbound Nat Rule Present but has no VM attached', (done) => {
        // VM has WinRMHttps Listener enabled, but no NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "OneLBOneVMInboundNatRulesPresent";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not enable winrm as it is already present");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('1 LB 2 VMs present, Inbound Nat Rule Present but has no VM attached', (done) => {
        // VM has WinRMHttps Listener enabled, but no NSG
        // VM has WinRMHttps Listener enabled, but no NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "OneLBTwoVMsInboundNatRulesPresent";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not enable winrm as it is already present");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('1 LB 1 VM present, Inbound Nat Rule Present and has VM attached', (done) => {
        // VM has WinRMHttps Listener enabled, but no NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "OneLBOneVMInboundNatRulesPresentVMAttached";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not enable winrm as it is already present");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('1 LB 2 Vms Present, Inbound Nat Rule Present and has VM attached', (done) => {
        // VM has WinRMHttps Listener enabled, but no NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "OneLBTwoVMsInboundNatRulesPresentVMsAttached";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not enable winrm as it is already present");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('VM doesnot have WinRMHttps Listener enabled, but has no Nsg', (done) => {
        // No LB present, No NSg
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionNotPresent";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > 0, "Should get the status for Custom Script Extension");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should enable winrm Https Listener");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('WinRM Custom Script Extension is present on the VM, status is succeeded, substatus is succeeded', (done) => {
        //No LB
        //1 VM
        //No NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionPresent";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > 0, "Should get the list of all the Custom Script Extensions");
            assert(tr.stdout.indexOf("Custom Script extension is for enabling Https Listener on VM") > 0, "The present custom script extension should enable winrm Https Listener");
            assert(tr.stdout.indexOf("Validating the winrm configuration custom script extension status") > 0, "Should validate the substatus of the extension");
            assert(tr.stdout.indexOf("virtualMachines.get is called with options: { expand: 'instanceView' }") > 0, "Should try to get the substatus of the extension");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not add Custom Script Extension");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('WinRM Custom Script Extension is present on the VM , status is succeeded, substatus is failed', (done) => {
        //No LB
        //1 VM
        //No NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionPresentInvalidSubstatus";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("Custom Script extension is for enabling Https Listener on VM") > 0, "The present custom script extension should enable winrm Https Listener");
            assert(tr.stdout.indexOf("Validating the winrm configuration custom script extension status") > 0, "Should validate the substatus of the extension present");
            assert(tr.stdout.indexOf("virtualMachines.get is called with options: { expand: 'instanceView' }") > 0, "Should try to get the substatus of the extension");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should add the extension");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('WinRM Custom Script Extension is present on the VM, status is failed', (done) => {
        //No LB
        //1 VM
        //No NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionPresentProvisioningStateIsNotSucceeded";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > 0, "The extensions on the vm should be listed to get the extension of concern");
            assert(tr.stdout.indexOf("Custom Script extension is for enabling Https Listener on VM") > 0, "The present custom script extension should enable winrm Https Listener");
            assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called") > 0, "Should remove the extension");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should add the extension");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try adding NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Vms have NSG', (done) => {
        //No LB
        //1 VM
        //WinRMHttps Listener enabled
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionPresentNSGPresent";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("Custom Script extension is for enabling Https Listener on VM") > 0, "The present custom script extension should enable winrm Https Listener");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should add the extension");
            assert(tr.stdout.indexOf("Validating the winrm configuration custom script extension status") > 0, "Should Validate the Custom Script Extension");
            assert(tr.stdout.indexOf("networkSecurityGroups.list is called") > 0, "Should list the Network Security Groups");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") > 0, "Shouldn't try to add NSG rule");
            assert(tr.stdout.indexOf("securityRules.get is called") > 0, "Should try to get the security rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('WinRM Custom Script Extension present is not for enabling WinRMHttpsListener', (done) => {
        // No LB
        // 1 VM, No Nsg
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionPresentWinRMHttpsListenerNotEnabled";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > 0, "The extensions on the vm should be listed to get the extension of concern");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should update the extension to enable WinrmHttps Listener");
            assert(tr.stdout.indexOf("networkSecurityGroups.list is called") > 0, "Should list the Network Security Groups");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Shouldn't try to add NSG rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('WinRM Custom Script is not present, VM has NSG associated', (done) => {
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionNotPresentNSGPresent";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should add the extension");
            assert(tr.stdout.indexOf("networkSecurityGroups.list is called") > 0, "Should list the Network Security Groups");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") > 0, "Shouldn't try to add NSG rule");
            assert(tr.stdout.indexOf("securityRules.get is called") > 0, "Should try to get the security rule");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('1 LB 1 VM, WinRM Custom Script extension is not present, VM has NSG associated', (done) => {
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "OneLBOneVMExtensionNotPresentNSGPresent";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > 0, "Should try to list all the Custom Script Extensions");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should enable winrm Https Listener");
            assert(tr.stdout.indexOf("networkSecurityGroups.list is called") > 0, "Should list the Network Security Groups");
            assert(tr.stdout.indexOf("securityRules.get is called") > 0, "Should try to get the security rule");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") > 0, "Should add NSG Rules");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('1 LB 2 Vms, WinRM Custom Script Extension is not present, VMs have NSG associated', (done) => {
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "OneLBTwoVMsExtensionNotPresentNSGPresent";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > 0, "Should try to get the Custom Script Extension");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should enable winrm Https Listener");
            assert(tr.stdout.indexOf("networkSecurityGroups.list is called") > 0, "Should list the Network Security Groups");
            assert(tr.stdout.indexOf("securityRules.get is called") > 0, "Should try to get the security rule");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") > 0, "Should add NSG Rules");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('WinRM Custom Script Extension is not present, but some other CustomScriptExtension is present', (done) => {
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "SomeOtherCustomScriptExtensionPresent";
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineExtensions.list is called") > 0, "Should try to get the Custom Script Extension");
            assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called") > 0, "Should try to delete the already existing Custom Script extension");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should enable winrm Https Listener");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('createOrUpdate deployment should fail when no template file is found', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMNotThere.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateFilePatternMatchingNoFile") > 0, "should have printed TemplateFilePatternMatchingNoFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('createOrUpdate deployment should fail when multiple template files are found', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMmultiple.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateFilePatternMatchingMoreThanOneFile") > 0, "should have printed TemplateFilePatternMatchingMoreThanOneFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('createOrUpdate deployment should fail when no parameter file is found', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSMNotThere.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateParameterFilePatternMatchingNoFile") > 0, "should have printed TemplateParameterFilePatternMatchingNoFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('createOrUpdate deployment should fail when multiple template files are found', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSMmultiple.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateParameterFilePatternMatchingMoreThanOneFile") > 0, "should have printed TemplateFilePatternMatchingMoreThanOneFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

});
