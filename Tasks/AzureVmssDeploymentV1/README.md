# Azure virtual machine scale set deployment task

## Windows custom script arguments

The new `DistributedTask.Tasks.VmssCustomScriptArgsValidationFixEnabled` flag is
additive to `DistributedTask.Tasks.EnableVmssCustomScriptArgsValidation`. With both
flags enabled and `AZP_75787_ENABLE_NEW_LOGIC` set to true, the task
checks characters on the agent and validates the final invocation syntax on the
Windows VM before executing the custom script. Strings, named arguments, Boolean
constants, literal arrays and constant hashtables are supported. Executable
expressions, script blocks, additional commands, redirections and stop-parsing
syntax are rejected.

When the new flag is missing or disabled, the pre-fix character policy and legacy
validation controls are preserved. The old gate still controls whether validation
runs; audit-only and telemetry-only modes do not enable the target-side syntax check.
Disabling the fix restores the previous behavior and exposure; it is not a
security-safe rollback. Linux invocation is unchanged.

## FAQ
### The script execution is reported as successful, however the VMSS instances are not updated
_Ans_: This might be due to the upgrade policy set on the VMSS. You can read more about it [here](https://docs.microsoft.com/en-us/azure/virtual-machine-scale-sets/virtual-machine-scale-sets-upgrade-scale-set#how-to-bring-vms-up-to-date-with-the-latest-scale-set-model). You can use the documentation there to update the virtual machine instance to latest model. You can also switch the upgrade policy. For example, to upgrade the policy, followig Az CLI command can be used: 
```az vmss update --set upgradePolicy.mode=Automatic -g <resource group name> -n <vmss name>```
