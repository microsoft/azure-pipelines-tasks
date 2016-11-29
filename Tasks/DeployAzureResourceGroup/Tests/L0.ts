/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>
"use strict";
const assert = require('assert');
const ttm = require('vsts-task-lib/mock-test');
const path = require('path');
var shell = require('shelljs');
function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}
describe('Azure Resource Group Deployment', function () {
    this.timeout(30000);
    before((done) => {
        done();
    });
    after(function () {
    });
    it('Successfully triggered createOrUpdate deployment', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
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
    it('Create or Update RG, failed on faulty CSM template file', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "\\faultyCSM.json";
        process.env["csmParametersFile"] = "\\faultyCSM.json";
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
    it('Select Resource Group failed on empty output Variable', (done) => {
        let tp = path.join(__dirname, 'selectResourceGroup.js');
        process.env["outputVariable"] = "";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.failed, "Task should have failed");
            assert(tr.stdout.indexOf("Output variable should not be empty") > 0, "Should have logged the output variable requirement.");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it("Deleted Resource Group", (done) => {
        let tp = path.join(__dirname, 'deleteResourceGroup.js');
        process.env["outputVariable"] = null;
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_ARG_DeletingResourceGroup") > 0, "Delete Resource Group function should have been called");
            assert(tr.stdout.indexOf("resourceGroups.deleteMethod is called") > 0, "Task should have called resourceGroups.deleteMethod function from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
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
            assert(tr.stdout.indexOf("loc_mock_VM_Stop") > 0, "Should have started VM");
            assert(tr.stdout.indexOf("virtualMachines.powerOff is called") > 0, "Should have called virtualMachines.powerOff function from azure-sdk");
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

        try{
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
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rule for the LB");
            assert(tr.stdout.indexOf("Enabling winrm for virtual machine") > 0, "Should add Custom Script Extension to the virual machine");
            assert(tr.stdout.indexOf("virtualMachineExtensions.get is called on vm customVM") > 0, "Should try getting the extension on the virtual machine");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should call createOrUpdate of virtual Machine extensions");
            assert(tr.stdout.indexOf("Addition of extension completed for vmcustomVM") > 0, "Should be able to add the extension");
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
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") > 0, "Should add the Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") > 0, "The NIC of the VMs should be updated");                    
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not try adding custom Script Extension as winrmHttps Listener is already enabled");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");            
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
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") > 0, "Should add the Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") > 0, "The NIC of the VMs should be updated");                    
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not enable winrm as it is already present");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");            
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
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") > 0, "Should add the Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") > 0, "The NIC of the VMs should be updated");                    
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not enable winrm as it is already present");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");            
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
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") > 0, "Should add the Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") > 0, "The NIC of the VMs should be updated");                    
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not enable winrm as it is already present");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");            
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
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not enable winrm as it is already present");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");            
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
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not enable winrm as it is already present");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");            
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
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.get is called") > 0, "Should get the status for Custom Script Extension");            
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should enable winrm Https Listener");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");            
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Custom Script Extension is present on the VM, status is succeeded, substatus is succeeded', (done) => {
        //No LB
        //1 VM
        //No NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionPresent";
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.get is called") > 0, "Should get the status for Custom Script Extension");
            assert(tr.stdout.indexOf("Custom Script extension is for enabling Https Listener on VM") > 0, "The present custom script extension should enable winrm Https Listener");
            assert(tr.stdout.indexOf("Validating the winrm configuration custom script extension status") > 0, "Should validate the substatus of the extension");
            assert(tr.stdout.indexOf("virtualMachines.get is called with options: { expand: 'instanceView' }") > 0, "Should try to get the substatus of the extension");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should not add Custom Script Extension");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");            
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Custom Script Extension is present on the VM , status is succeeded, substatus is failed', (done) => {
        //No LB
        //1 VM
        //No NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionPresentInvalidSubstatus";
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("Custom Script extension is for enabling Https Listener on VM") > 0, "The present custom script extension should enable winrm Https Listener");
            assert(tr.stdout.indexOf("Validating the winrm configuration custom script extension status") > 0, "Should validate the substatus of the extension present");
            assert(tr.stdout.indexOf("virtualMachines.get is called with options: { expand: 'instanceView' }") > 0, "Should try to get the substatus of the extension");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should add the extension");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");            
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Custom Script Extension is present on the VM, status is failed', (done) => {
        //No LB
        //1 VM
        //No NSG
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionPresentProvisioningStateIsNotSucceeded";
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("Custom Script extension is for enabling Https Listener on VM") > 0, "The present custom script extension should enable winrm Https Listener");
            assert(tr.stdout.indexOf("virtualMachineExtensions.deleteMethod is called") > 0, "Should remove the extension");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should add the extension");
            assert(tr.stdout.indexOf("virtualMachines.get is called with options: { expand: 'instanceView' }") <= 0, "Should not try to get the substatus of the extension");
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try adding NSG rule");            
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
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("Custom Script extension is for enabling Https Listener on VM") > 0, "The present custom script extension should enable winrm Https Listener");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") <= 0, "Should add the extension");
            assert(tr.stdout.indexOf("Validating the winrm configuration custom script extension status") > 0, "Should Validate the Custom Script Extension");
            assert(tr.stdout.indexOf("virtualMachines.get is called with options: { expand: 'instanceView' }") > 0, "Should try to get the substatus of the extension");
            assert(tr.stdout.indexOf("networkSecurityGroups.list is called") > 0, "Should list the Network Security Groups");            
            assert(tr.stdout.indexOf("Trying to add a network security group rule") > 0, "Shouldn't try to add NSG rule");
            assert(tr.stdout.indexOf("securityRules.get is called") > 0, "Should try to get the security rule");       
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group"))     
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Custom Script Extension present is not for enabling WinRMHttpsListener', (done) => {
        // No LB
        // 1 VM, No Nsg
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionPresentWinRMHttpsListenerNotEnabled";
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachines.get is called") <= 0, "Trying to get the extension on the Virtual machines");            
            assert(tr.stdout.indexOf("Custom Script Extension present doesn't enable Https Listener on VM") > 0, "The present custom script extension should not enable winrm Https Listener");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should update the extension to enable WinrmHttps Listener");
            assert(tr.stdout.indexOf("networkSecurityGroups.list is called") > 0, "Should list the Network Security Groups");            
            assert(tr.stdout.indexOf("Trying to add a network security group rule") <= 0, "Shouldn't try to add NSG rule");
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") <= 0, "Should not try to add security rules as no NSG is present");     
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Custom Script is not present, VM has NSG associated', (done) => {
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "ExtensionNotPresentNSGPresent";
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") <= 0, "Shouldn't add Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") <= 0, "LoadBalancers.createOrUpdate should not have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") <= 0, "The NIC of the VMs should not be updated");
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should add the extension");
            assert(tr.stdout.indexOf("networkSecurityGroups.list is called") > 0, "Should list the Network Security Groups");            
            assert(tr.stdout.indexOf("Trying to add a network security group rule") > 0, "Shouldn't try to add NSG rule");
            assert(tr.stdout.indexOf("securityRules.get is called") > 0, "Should try to get the security rule");       
            assert(tr.stdout.indexOf("securityRules.createOrUpdate is called: Added rule Name VSO-Custom-WinRM-Https-Port to the security Group") > 0, "Should add the NSG rule")     
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('1 LB 1 VM, Custom Script extension is not present, VM has NSG associated', (done) => {
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "OneLBOneVMExtensionNotPresentNSGPresent";
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") > 0, "Should add the Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") > 0, "The NIC of the VMs should be updated");                    
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.get is called") > 0, "Should try to get the Custom Script Extension");            
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should enable winrm Https Listener");
            assert(tr.stdout.indexOf("networkSecurityGroups.list is called") > 0, "Should list the Network Security Groups");            
            assert(tr.stdout.indexOf("Trying to add a network security group rule") > 0, "Should try to add NSG rule");
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
    it('1 LB 2 Vms, Custom Script Extension is not present, VMs have NSG associated', (done) => {
        let tp = path.join(__dirname, 'EnablePrereq.js');
        process.env["resourceGroupName"] = "OneLBTwoVMsExtensionNotPresentNSGPresent";
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();

        try{
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loadBalancers.list is called") > 0, "loadBalancers.list should have been called");
            assert(tr.stdout.indexOf("Updating the load balancers with the appropriate Inbound Nat rules") > 0, "Should add the Inbound Nat Rules to the LB");
            assert(tr.stdout.indexOf("loadBalancers.createOrUpdate is called") > 0, "LoadBalancers.createOrUpdate should have been called");    
            assert(tr.stdout.indexOf("Updating the NIC of the concerned vms") > 0, "The NIC of the VMs should be updated");                    
            assert(tr.stdout.indexOf("networkInterfaces.list is called") > 0, "The network Interfaces of the vms should be listed");
            assert(tr.stdout.indexOf("networkInterfaces.createOrUpdate is called") > 0, "The network Interfaces of the vms should be updated with appropriate Inbound Nat Rules of LB");
            assert(tr.stdout.indexOf("virtualMachineExtensions.get is called") > 0, "Should try to get the Custom Script Extension");            
            assert(tr.stdout.indexOf("virtualMachineExtensions.createOrUpdate is called") > 0, "Should enable winrm Https Listener");
            assert(tr.stdout.indexOf("networkSecurityGroups.list is called") > 0, "Should list the Network Security Groups");            
            assert(tr.stdout.indexOf("Trying to add a network security group rule") > 0, "Should try to add NSG rule");
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
});
