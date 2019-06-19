# Azure virtual machine scale set deployment task

## FAQ
### The script execution is reported as successful, however the VMSS instances are not updated
_Ans_: This might be due to the upgrade policy set on the VMSS. You can read more about it [here](https://docs.microsoft.com/en-us/azure/virtual-machine-scale-sets/virtual-machine-scale-sets-upgrade-scale-set#how-to-bring-vms-up-to-date-with-the-latest-scale-set-model). You can use the documentation there to update the virtual machine instance to latest model. You can also switch the upgrade policy. For example, to upgrade the policy, followig Az CLI command can be used: 
```az vmss update --set upgradePolicy.mode=Automatic -g <resource group name> -n <vmss name>```
