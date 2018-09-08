import * as ttm from 'vsts-task-lib/mock-test';
import * as tl from 'vsts-task-lib';
import * as path from 'path';
import * as assert from 'assert';

describe('AzureNLBManagement Suite', () => {
	before(() => {

    });

    after(() => {

    });

    it('disconnects the virtual machine successfully from the load balancer\'s backend pool', (done: MochaDone) => {
    	let tp = path.join(__dirname, 'L0DisconnectSuccess.js');
        let tmr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tmr.run();

        assert(tmr.stderr.length == 0 && tmr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tmr.stdOutContained("Getting Primary Network Interface for the virtual machine : test-vm"), "should have said : Getting Primary Network Interface for the virtual machine : test-vm");
        assert(tmr.stdOutContained("Network Interface - test-nic1's configuration details fetched for the virtual machine test-vm"), "should have said : Network Interface - test-nic1's configuration details fetched for the virtual machine test-vm");
        assert(tmr.stdOutContained("loc_mock_DisconnectingVMfromLB"), "should have said : loc_mock_DisconnectingVMfromLB");
        assert(tmr.stdOutContained("loc_mock_SettingTheNetworkInterface"), "should have said : loc_mock_SettingTheNetworkInterface");
        assert(tmr.stdOutContained("loc_mock_setNICStatusSuccess"), "should have said : loc_mock_setNICStatusSuccess");
        assert(tmr.stdOutContained("loc_mock_ActionCompletedSuccefully"), "should have said : loc_mock_ActionCompletedSuccefully");
        assert(tmr.succeeded, 'task should have succeeded');
    	done();
    });
    
    it('connects the virtual machine successfully to the load balancer\'s backend pool', (done: MochaDone) => {
    	let tp = path.join(__dirname, 'L0ConnectSuccess.js');
        let tmr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tmr.run();

        assert(tmr.stderr.length == 0 && tmr.errorIssues.length == 0, 'should not have written to stderr');
        assert(tmr.stdOutContained("Getting Primary Network Interface for the virtual machine : test-vm"), "should have said : Getting Primary Network Interface for the virtual machine : test-vm");
        assert(tmr.stdOutContained("Network Interface - test-nic1's configuration details fetched for the virtual machine test-vm"), "should have said : Network Interface - test-nic1's configuration details fetched for the virtual machine test-vm");
        assert(tmr.stdOutContained("loc_mock_ConnectingVMtoLB"), "should have said : loc_mock_ConnectingVMtoLB");
        assert(tmr.stdOutContained("Getting the load balancer: testLB"), "should have said : Getting the load balancer: testLB");
        assert(tmr.stdOutContained("loc_mock_SettingTheNetworkInterface"), "should have said : loc_mock_SettingTheNetworkInterface");
        assert(tmr.stdOutContained("loc_mock_setNICStatusSuccess"), "should have said : loc_mock_setNICStatusSuccess");
        assert(tmr.stdOutContained("loc_mock_ActionCompletedSuccefully"), "should have said : loc_mock_ActionCompletedSuccefully");
        assert(tmr.succeeded, 'task should have succeeded');
    	done();
    });

    it('fails if primary network interface not found', (done: MochaDone) => {
    	let tp = path.join(__dirname, 'L0TaskFail.js');
        let tmr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tmr.run();

        assert(tmr.stderr.length > 0 || tmr.errorIssues.length > 0, 'should have written to stderr');
        assert(tmr.stdOutContained("Getting Primary Network Interface for the virtual machine : test-vm"), "should have said : Getting Primary Network Interface for the virtual machine : test-vm");
        assert(tmr.stdErrContained("loc_mock_CouldNotFetchNicDetails") || tmr.createdErrorIssue("loc_mock_CouldNotFetchNicDetails"), "should have said : loc_mock_CouldNotFetchNicDetails");
        assert(tmr.failed, 'task should have failed');
        done();
    });
    it('fails if could not fetch all network interfaces in resource group', (done: MochaDone) => {
        let tp = path.join(__dirname, 'L0TaskFailNetworkInterfaceRG.js');
        let tmr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tmr.run();

        assert(tmr.stderr.length > 0 || tmr.errorIssues.length > 0, 'should have written to stderr');
        assert(tmr.stdErrContained("loc_mock_CouldNotFetchNetworkInterfacesInRg") || tmr.createdErrorIssue("loc_mock_CouldNotFetchNetworkInterfacesInRg"), "should have said : loc_mock_CouldNotFetchNicDetails");
        assert(tmr.failed, 'task should have failed');
        done();
    });
    it('fails if setting the network interface fails', (done: MochaDone) => {
        let tp = path.join(__dirname, 'L0TaskFailSetNetworkInterface.js');
        let tmr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tmr.run();

        assert(tmr.stderr.length > 0 || tmr.errorIssues.length > 0, 'should have written to stderr');
        assert(tmr.stdOutContained("Getting Primary Network Interface for the virtual machine : test-vm"), "should have said : Getting Primary Network Interface for the virtual machine : test-vm");
        assert(tmr.stdOutContained("Network Interface - test-nic1's configuration details fetched for the virtual machine test-vm"), "should have said : Network Interface - test-nic1's configuration details fetched for the virtual machine test-vm");
        assert(tmr.stdOutContained("loc_mock_DisconnectingVMfromLB"), "should have said : loc_mock_DisconnectingVMfromLB");
        assert(tmr.stdOutContained("loc_mock_SettingTheNetworkInterface"), "should have said : loc_mock_SettingTheNetworkInterface");
        assert(tmr.stdErrContained("loc_mock_FailedSettingNetworkInterface") || tmr.createdErrorIssue("loc_mock_FailedSettingNetworkInterface"), "should have said : loc_mock_FailedSettingNetworkInterface");
        assert(tmr.failed, 'task should have failed');
        done();
    });
    it('connect fails if load balancer not found', (done: MochaDone) => {
    	let tp = path.join(__dirname, 'L0ConnectFailNoLB.js');
        let tmr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tmr.run();

        assert(tmr.stderr.length > 0 || tmr.errorIssues.length > 0, 'should have written to stderr');
        assert(tmr.stdOutContained("Getting Primary Network Interface for the virtual machine : test-vm"), "should have said : Getting Primary Network Interface for the virtual machine : test-vm");
        assert(tmr.stdOutContained("Network Interface - test-nic1's configuration details fetched for the virtual machine test-vm"), "should have said : Network Interface - test-nic1's configuration details fetched for the virtual machine test-vm");
        assert(tmr.stdOutContained("loc_mock_ConnectingVMtoLB"), "should have said : loc_mock_ConnectingVMtoLB");
        assert(tmr.stdOutContained("Getting the load balancer: testLB"), "should have said : Getting the load balancer: testLB");
        assert(tmr.stdErrContained("loc_mock_CouldNotFetchLoadBalancer") || tmr.createdErrorIssue("loc_mock_CouldNotFetchLoadBalancer"), "should have said : loc_mock_CouldNotFetchLoadBalancer");
        assert(tmr.failed, 'task should have failed');

        done();
    });
});