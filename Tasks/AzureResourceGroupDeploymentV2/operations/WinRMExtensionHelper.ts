import networkManagementClient = require("azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-network");
import computeManagementClient = require("azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-compute");
import util = require("util");
import tl = require("azure-pipelines-task-lib/task");
import azure_utils = require("./AzureUtil");
import deployAzureRG = require("../models/DeployAzureRG");
import az = require("azure-pipelines-tasks-azure-arm-rest-v2/azureModels");
import utils = require("./Utils");
import webRequestUtility = require("azure-pipelines-tasks-azure-arm-rest-v2/webRequestUtility");

export class WinRMExtensionHelper {
    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private resourceGroupName: string;
    private credentials;
    private subscriptionId: string;
    private fqdnMap;
    private winRmHttpsPortMap;
    private virtualMachines;
    private customScriptExtensionInstalled: boolean;
    private ruleAddedToNsg: boolean;
    private azureUtils: azure_utils.AzureUtil;
    private networkClient: networkManagementClient.NetworkManagementClient;
    private computeClient: computeManagementClient.ComputeManagementClient;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.resourceGroupName = this.taskParameters.resourceGroupName;
        this.credentials = this.taskParameters.credentials;
        this.subscriptionId = this.taskParameters.subscriptionId;
        this.fqdnMap = {};
        this.winRmHttpsPortMap = {};
        this.customScriptExtensionInstalled = false;
        this.ruleAddedToNsg = false;

        this.networkClient = new networkManagementClient.NetworkManagementClient(this.credentials, this.subscriptionId);
        this.computeClient = new computeManagementClient.ComputeManagementClient(this.credentials, this.subscriptionId);
        this.azureUtils = new azure_utils.AzureUtil(this.taskParameters, this.computeClient, this.networkClient);
    }

    public async ConfigureWinRMExtension(): Promise<void> {
        await this.AddInboundNatRulesOnLoadBalancers();
        await this.AddExtensionToVMsToConfigureWinRM();
        await this.AddNetworkSecurityRuleConfigForWinRMPort();
    }

    private async AddInboundNatRulesOnLoadBalancers(): Promise<void> {
        tl.debug("Trying to add Inbound Nat Rule to the LBs...");
        var resourceGroupDetails = await this.azureUtils.getResourceGroupDetails();
        for (var virtualMachine of resourceGroupDetails.VirtualMachines) {
            if (!utils.isNonEmpty(virtualMachine.WinRMHttpsPublicAddress)) {
                tl.debug("Adding Inbound Nat Rule for the VM: " + virtualMachine.Name);
                var lb: azure_utils.LoadBalancer;
                var nicId: string;
                for (var nic of virtualMachine.NetworkInterfaceIds) {
                    nicId = nic;
                    lb = resourceGroupDetails.LoadBalancers.find(l => !!l.BackendNicIds.find(id => id === nic));
                    if (lb) break;
                }

                if (lb) {
                    tl.debug("LB to which Inbound Nat Rule for VM " + virtualMachine.Name + " is to be added is " + lb.Id);
                    var frontendPort: number = this.GetFreeFrontendPort(lb);
                    await this.AddNatRuleInternal(lb.Id, nicId, frontendPort, 5986, virtualMachine.Name);
                    lb.FrontEndPortsInUse.push(frontendPort);
                }
                else {
                    tl.warning("There is no public address to reach the virtual machine x.");
                }
            }
            else {
                tl.debug("No need to add Inbound Nat rule for vm " + virtualMachine.Name);
            }
        }
    }

    private GetFreeFrontendPort(loadBalancer: azure_utils.LoadBalancer): number {
        var port: number = 5986;
        while (loadBalancer.FrontEndPortsInUse.find(p => p == port)) {
            port++;
        }
        tl.debug("Free port for Load balancer " + loadBalancer.Id + " is " + port);
        return port;
    }

    private async AddNatRuleInternal(loadBalancerId: string, networkInterfaceId: string, fronendPort: number, backendPort: number, virtualMachineName: string): Promise<void> {
        var random: number = Math.floor(Math.random() * 10000 + 100);
        var name: string = "winRMHttpsRule" + random.toString();
        var loadBalancers = await this.azureUtils.getLoadBalancers();
        var loadBalancer = loadBalancers.find(l => l.id == loadBalancerId);

        var InboundNatRuleProperties: az.InboundNatRuleProperties = {
            backendPort: backendPort,
            frontendPort: fronendPort,
            frontendIPConfiguration: { id: loadBalancer.properties.frontendIPConfigurations[0].id },
            protocol: "Tcp",
            idleTimeoutInMinutes: 4,
            enableFloatingIP: false
        }

        var rule: az.InboundNatRule = {
            id: "",
            name: name,
            properties: InboundNatRuleProperties
        };

        loadBalancer.properties.inboundNatRules.push(rule);
        var networkInterfaces = this.azureUtils.networkInterfaceDetails;
        var networkInterface = networkInterfaces.find(n => n.id == networkInterfaceId);
        var ipConfiguration: az.IPConfiguration;

        for (var ipc of networkInterface.properties.ipConfigurations) {
            for (var pool of loadBalancer.properties.backendAddressPools) {
                if (pool.properties.backendIPConfigurations && pool.properties.backendIPConfigurations.find(x => x.id == ipc.id)) {
                    if (!ipc.properties.loadBalancerInboundNatRules) {
                        ipc.properties.loadBalancerInboundNatRules = [];
                    }
                    ipConfiguration = ipc;
                    break;
                }
            }
        }

        if (!!loadBalancer && !!networkInterface) {
            await this.AddInboundNatRule(networkInterface, loadBalancer, ipConfiguration, fronendPort, virtualMachineName);
        }
    }

    private AddInboundNatRule(networkInterface: az.NetworkInterface, loadBalancer: az.LoadBalancer, ipConfiguration: az.IPConfiguration, fronendPort: number, virtualMachineName: string) {
        return new Promise<void>(async (resolve, reject) => {
            console.log(tl.loc("AddingInboundNatRule", virtualMachineName, loadBalancer.name));
            this.networkClient.loadBalancers.createOrUpdate(this.resourceGroupName, loadBalancer.name, loadBalancer, null, (error, result, request, response) => {
                if (error) {
                    console.log(tl.loc("InboundNatRuleAdditionFailed", loadBalancer.name, utils.getError(error)));
                    reject(tl.loc("InboundNatRuleAdditionFailed", loadBalancer.name, utils.getError(error)));
                }
                else {
                    var loadBalancerUpdated = <az.LoadBalancer>result;
                    var addedRule = loadBalancerUpdated.properties.inboundNatRules.find(r => r.properties.frontendPort == fronendPort);
                    ipConfiguration.properties.loadBalancerInboundNatRules.push(addedRule);
                    tl.debug("Updating the loadBalancerInboundNatRules of nic " + networkInterface.name);
                    this.networkClient.networkInterfaces.createOrUpdate(this.resourceGroupName, networkInterface.name, networkInterface, null,
                        (error2, result2, request2, response2) => {
                            if (error2) {
                                console.log(tl.loc("InboundNatRulesToNICFailed", networkInterface.name, utils.getError(error2)));
                                reject(tl.loc("InboundNatRulesToNICFailed", networkInterface.name, utils.getError(error2)));
                                return;
                            }
                            console.log(tl.loc("AddedTargetInboundNatRuleLB", networkInterface.name));
                            resolve();
                        });
                }
            });
        });
    }

    private async AddNetworkSecurityRuleConfigForWinRMPort(): Promise<void> {
        var ruleName: string = "VSO-Custom-WinRM-Https-Port";
        var rulePriority: number = 3986;
        var winrmHttpsPort: string = "5986";
        var securityGroups = await this.GetNetworkSecurityGroups();
        var promises = [];
        if (securityGroups && securityGroups.length) {
            tl.debug("Trying to add a network security group rule");
            for (var i = 0; i < securityGroups.length; i++) {
                console.log(tl.loc("AddingSecurityRuleNSG", securityGroups[i]["name"]));
                var securityGrp = securityGroups[i];
                var securityGrpName = securityGrp["name"];

                tl.debug("Getting the network security rule config " + ruleName + " under security group " + securityGrpName);
                promises.push(this.TryAddNetworkSecurityRule(securityGrpName, ruleName, rulePriority, winrmHttpsPort));
            }
        }

        return new Promise<any>((resolve, reject) => {
            Promise.all(promises).then(() => {
                tl.debug("Finished adding rules to the network security groups");
                resolve(null);
            }).catch((exception) => {
                tl.debug("Failed to add the network security rules with the exception " + exception);
                reject(exception);
            });
        });
    }

    private async AddInboundNetworkSecurityRule(securityGrpName: string, ruleName: string, rulePriority: number, winrmHttpsPort: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            tl.debug("Adding inbound network security rule config " + ruleName + " with priority " + rulePriority + " for port " + winrmHttpsPort + " under security group " + securityGrpName);
            var securityRuleParameters = {
                properties: {
                    direction: "Inbound",
                    access: "Allow",
                    sourceAddressPrefix: "*",
                    sourcePortRange: "*",
                    destinationAddressPrefix: "*",
                    destinationPortRange: winrmHttpsPort,
                    protocol: "*",
                    priority: rulePriority
                }
            };
            this.networkClient.securityRules.createOrUpdate(this.resourceGroupName, securityGrpName, ruleName, securityRuleParameters, (error, result, request, response) => {
                if (error) {
                    tl.debug("Error in adding network security rule " + util.inspect(error, { depth: null }));
                    tl.debug("Failed to add inbound network security rule config " + ruleName + " with priority " + rulePriority + " for port " + winrmHttpsPort + " under security group " + securityGrpName);
                    rulePriority = rulePriority + 50;
                    return reject(utils.getError(error));
                }
                console.log(tl.loc("AddedSecurityRuleNSG", ruleName, rulePriority, winrmHttpsPort, securityGrpName, util.inspect(result, { depth: null })));
                return resolve();
            });
        });
    }

    private async AddInboundNetworkSecurityRuleWithRetry(retryCnt: number, securityGrpName: string, ruleName: string, rulePriority: number, winrmHttpsPort: string) {
        for (var i = 0; i < 3; i++) {
            try {
                await this.AddInboundNetworkSecurityRule(securityGrpName, ruleName, rulePriority, winrmHttpsPort);
                return;
            }
            catch (exception) {
            }
        }

        throw tl.loc("FailedAddingNSGRule3Times", securityGrpName);
    }

    private async TryAddNetworkSecurityRule(securityGrpName: string, ruleName: string, rulePriority: number, winrmHttpsPort: string) {
        var result = await this.GetSecurityRules(securityGrpName, ruleName);
        if (!result) {
            tl.debug("Rule " + ruleName + " not found under security Group " + securityGrpName);
            var maxRetries = 3;
            await this.AddInboundNetworkSecurityRuleWithRetry(maxRetries, securityGrpName, ruleName, rulePriority, winrmHttpsPort);
        }
        else {
            console.log(tl.loc("RuleExistsAlready", ruleName, securityGrpName));
        }
    }

    private GetSecurityRules(securityGrpName: string, ruleName: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.networkClient.securityRules.get(this.resourceGroupName, securityGrpName, ruleName, null, (error, result, request, response) => {
                if (error) {
                    return resolve(null); // Rule doesnt exist;
                }
                resolve(result);
            });
        });
    }

    private GetNetworkSecurityGroups(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.networkClient.networkSecurityGroups.list(this.resourceGroupName, null, (error, result, request, response) => {
                if (error) {
                    tl.debug("Failed to get the list of NSG " + JSON.stringify(error));
                    reject(utils.getError(error));
                    return;
                }
                resolve(result);
            });
        });
    }

    private async AddExtensionToVMsToConfigureWinRM() {
        var resourceGroupDetails = await this.azureUtils.getResourceGroupDetails();
        var promises = [];
        for (var vm of this.azureUtils.vmDetails) {
            var resourceName = vm.name;
            var resourceId = vm.id;
            var vmResource = resourceGroupDetails.VirtualMachines.find(v => v.Name == resourceName);
            var resourceFQDN = vmResource.WinRMHttpsPublicAddress;
            var resourceWinRmHttpsPort = vmResource.WinRMHttpsPort
            if (vm["properties"]["storageProfile"]["osDisk"]["osType"] === 'Windows') {
                tl.debug("Enabling winrm for virtual machine " + resourceName);
                promises.push(this.AddWinRMExtension(resourceId, resourceName, resourceFQDN, vm["location"]));
            }
            else {
                tl.debug("WinRM extension cannot be enabled on the virtual machine: " + resourceName + "since the OS type is " +
                    vm.properties["storageProfile"]["osDisk"]["osType"]);
            }
        }
        return new Promise<any>((resolve, reject) => {
            Promise.all(promises).then(() => {
                tl.debug("Added custom script extension to all the vms in the resource group");
                resolve(null);
            }).catch((exception) => {
                tl.debug("Failed to add extension to the vms with the exception: " + exception);
                reject(exception);
            });
        });
    }

    private async AddWinRMExtension(vmId: string, vmName: string, dnsName: string, location: string) {
        var extensionName: string = "WinRMCustomScriptExtension";
        var configWinRMScriptFileFwdLink: string = "https://aka.ms/vstsconfigurewinrm";
        var makeCertFileFwdLink: string = "https://aka.ms/vstsmakecertexe";

        var configWinRMScriptFile: string = await webRequestUtility.getTargetUriFromFwdLink(configWinRMScriptFileFwdLink);
        var makeCertFile: string = await webRequestUtility.getTargetUriFromFwdLink(makeCertFileFwdLink);
        
        var fileUris = [configWinRMScriptFile, makeCertFile];

        tl.debug("Adding custom script extension for virtual machine " + vmName);
        tl.debug("VM Location: " + location);
        tl.debug("VM DNS: " + dnsName);

        tl.debug("Checking if the extension " + extensionName + " is present on vm " + vmName);
        var result = await this.GetCustomScriptExtension(vmName);
        tl.debug("Matching extension: " + JSON.stringify(result));
        var extensionStatusValid = false;
        if (result) {
            if (result["name"] == extensionName && result["properties"]["settings"]["fileUris"].length == fileUris.length && fileUris.every((element, index) => { return element === result["properties"]["settings"]["fileUris"][index]; })) {
                tl.debug("Custom Script extension is for enabling Https Listener on VM: " + vmName);
                if (result["properties"]["provisioningState"] === 'Succeeded') {
                    try {
                        await this.ValidateExtensionExecutionStatus(vmName, dnsName, extensionName, location, fileUris);
                        extensionStatusValid = true;
                    }
                    catch (exception) {
                        tl.debug("Extension substatus is: " + exception);
                    }
                }
            }

            if (!extensionStatusValid) {
                await this.RemoveExtensionFromVM(result["name"], vmName);
            }
        }
        if (!extensionStatusValid) {
            await this.AddExtensionToVM(vmName, dnsName, extensionName, location, fileUris);
        }
        tl.debug("Addition of Custom Script Extension is completed on vm: " + vmName);
    }

    private GetCustomScriptExtension(vmName: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.computeClient.virtualMachineExtensions.list(this.resourceGroupName, vmName, az.ComputeResourceType.VirtualMachine, null, async (error, result, request, response) => {
                if (error) {
                    reject(tl.loc("ListingOfExtensionsFailed", vmName, utils.getError(error)));
                    return;
                }

                tl.debug("Result of listing the extensions: " + JSON.stringify(result));
                var extensions: az.VMExtension[] = result || [];
                var matchingExtension: az.VMExtension = null;
                extensions.forEach((extension: az.VMExtension) => {
                    if (extension.properties.type == "CustomScriptExtension" &&
                        extension.properties.publisher == "Microsoft.Compute") {
                        matchingExtension = extension;
                    }
                });
                resolve(matchingExtension);
            });
        });
    }

    private async ValidateExtensionExecutionStatus(vmName: string, dnsName: string, extensionName: string, location: string, fileUris): Promise<void> {
        tl.debug("Validating the winrm configuration custom script extension status on vm: " + vmName);

        return new Promise<void>((resolve, reject) => {
            this.computeClient.virtualMachines.get(this.resourceGroupName, vmName, { expand: 'instanceView' }, async (error, result, request, response) => {
                if (error) {
                    reject(tl.loc("FailedToFetchInstanceViewVM", utils.getError(error)));
                    return;
                }
                var extensionPresent: boolean = false;
                tl.debug("Got the Instance View of the virtualMachine " + vmName + ": " + JSON.stringify(result));
                var errorMessage = null;
                if (result["properties"]["instanceView"] && result["properties"]["instanceView"]["extensions"]) {
                    var extensions = result["properties"]["instanceView"]["extensions"];
                    for (var extension of extensions) {
                        if (extension["name"] === extensionName) {
                            extensionPresent = true;
                            for (var substatus of extension["substatuses"]) {
                                if (substatus["code"] && substatus["code"].indexOf("ComponentStatus/StdErr") >= 0 && substatus["message"]) {
                                    errorMessage = substatus["message"];
                                    break;
                                }
                            }
                            break;
                        }
                    }
                }
                if (!extensionPresent) {
                    errorMessage = tl.loc("ExtensionNotFound", vmName);
                }
                if (errorMessage) {
                    reject(errorMessage);
                }
                else {
                    tl.debug("Custom Script Extension status validated for vm: " + vmName + "!!");
                    resolve();
                }
            });
        });
    }

    private async AddExtensionToVM(vmName: string, dnsName: string, extensionName: string, location: string, _fileUris): Promise<any> {
        var _commandToExecute: string = "powershell.exe -ExecutionPolicy RemoteSigned -File ConfigureWinRM.ps1 " + dnsName;
        var _extensionType: string = 'Microsoft.Compute/virtualMachines/extensions';
        var _virtualMachineExtensionType: string = 'CustomScriptExtension';
        var _typeHandlerVersion: string = '1.7';
        var _publisher: string = 'Microsoft.Compute';

        var _protectedSettings = { commandToExecute: _commandToExecute };
        var parameters = {
            type: _extensionType,
            location: location,
            properties: {
                publisher: _publisher,
                type: _virtualMachineExtensionType,
                typeHandlerVersion: _typeHandlerVersion,
                settings: {
                    fileUris: _fileUris,
                    commandToExecute: _commandToExecute
                }
            }
        };

        console.log(tl.loc("AddExtension", extensionName, vmName));
        return new Promise<any>((resolve, reject) => {
            this.computeClient.virtualMachineExtensions.createOrUpdate(this.resourceGroupName, vmName, az.ComputeResourceType.VirtualMachine, extensionName, parameters, async (error, result, request, response) => {
                if (error) {
                    console.log(tl.loc("CreationOfExtensionFailed", vmName, utils.getError(error)));
                }
                else {
                    tl.debug("Addition of extension completed for vm: " + vmName);
                    if (result["properties"]["provisioningState"] != 'Succeeded') {
                        console.log(tl.loc("ProvisioningStatusOfExtensionIsNotSucceeded", vmName));
                        tl.debug("Result: " + JSON.stringify(result));
                    }
                }
                try {
                    await this.ValidateExtensionExecutionStatus(vmName, dnsName, extensionName, location, _fileUris);
                }
                catch (exception) {
                    tl.debug("WinRMCustomScriptExtension is not valid on vm " + vmName);
                    reject(tl.loc("ARG_SetExtensionFailedForVm", vmName, exception));
                    return;
                }
                tl.debug("Provisioning of CustomScriptExtension on vm " + vmName + " is in Succeeded State");
                this.customScriptExtensionInstalled = true;
                console.log(tl.loc("AddedExtension", vmName));
                resolve();
            });
        });
    }

    private async RemoveExtensionFromVM(extensionName, vmName): Promise<any> {
        tl.debug("Removing the extension " + extensionName + "from vm " + vmName);
        //delete the extension
        return new Promise<any>((resolve, reject) => {
            this.computeClient.virtualMachineExtensions.deleteMethod(this.resourceGroupName, vmName, az.ComputeResourceType.VirtualMachine, extensionName, async (error, result, request, response) => {
                if (error) {
                    tl.debug("Failed to delete the extension " + extensionName + " on the vm " + vmName + ", with error Message: " + util.inspect(error, { depth: null }));
                    reject(tl.loc("FailedToDeleteExtension"));
                    return;
                }

                tl.debug("Successfully removed the extension " + extensionName + " from the VM " + vmName);
                resolve();
            });
        });
    }
}