# Azure virtual machine scale set deployment task

## Protected Windows custom-script invocation

Enable both `DistributedTask.Tasks.EnableVmssCustomScriptArgsValidation` and
`DistributedTask.Tasks.VmssCustomScriptArgsValidationFixEnabled` to use the
protected Windows path. Their combined check is sufficient; legacy AZP activation
and audit settings do not disable this path.

The task stages a bounded UTF-8 JSON payload separately from the scripts and
launches a fixed bootstrap through a generated ASCII path. Script names and
argument text do not enter the CMD command line. The target validates the final
PowerShell invocation before evaluation, permitting only the trusted script and
constant argument structures. Named/switch arguments, quoted text, Boolean/null
constants, literal arrays and constant hashtables retain PowerShell binding.

Protected mode requires a relative `.ps1` target and limits the complete UTF-8
payload to 1 MiB. Expressions, nested commands, redirection, stop-parsing syntax,
and malformed payloads fail explicitly. Bootstrap and payload remain outside
archive extraction; command/download settings use protected extension settings.
The uploaded payload contains argument data and must have the same trusted storage
and access controls as the deployment package. Encoding/serialization is not secrecy.

When either FF is missing/off, the legacy path remains unchanged, including its
known exposure; disabling the fix is not a security-safe rollback. Linux is
unchanged. Producer and bootstrap must be deployed as a compatible pair.

### Argument policy and compatibility

The agent's character policy and the target's syntax policy both apply. Transport
preserves UTF-8 data, but that does not make every Unicode character or PowerShell
language form acceptable to the character policy. Examples below assume matching
parameters on the selected trusted script.

| Example | Protected-mode behavior |
| --- | --- |
| `-Value named -Switch` | Named parameters and switches use PowerShell binding. |
| `-Value $false`, `-Value $null`, `-Value ''` | Boolean false, null and empty remain distinct values. |
| `one,two` | Literal array. |
| `@{ k = 1 }` | Single-entry constant hashtable. |
| `'literal $true'` | Literal string; no interpolation. |
| `"literal $true"` | Rejected by the target: expandable strings are not constant AST forms. |
| `@{ k = Get-Date }` | Rejected by the target: nested command. |
| `@{ first = 1; second = 2 }` | Rejected by the agent: semicolons are not permitted, including in multi-entry hashtables. |
| `a` followed by a backtick-escaped ampersand | Remains literal PowerShell argument content; it never enters CMD. |

Policy is resolved once for the invocation and reused by validation and command
selection. Both task majors have parity checks for the producer, argument policy
and bootstrap. The target engine is Windows PowerShell; no PowerShell process is
required on the agent. Trusted scripts are not sandboxed by this validation.

If agent staging cleanup fails, the task reports it explicitly. A primary
preparation/upload failure is retained, with a separate cleanup warning; a cleanup
failure after otherwise successful preparation remains a task failure. Uploaded
blob and target-file retention require deployment-owner controls.

## FAQ
### The script execution is reported as successful, however the VMSS instances are not updated
_Ans_: This might be due to the upgrade policy set on the VMSS. You can read more about it [here](https://docs.microsoft.com/en-us/azure/virtual-machine-scale-sets/virtual-machine-scale-sets-upgrade-scale-set#how-to-bring-vms-up-to-date-with-the-latest-scale-set-model). You can use the documentation there to update the virtual machine instance to latest model. You can also switch the upgrade policy. For example, to upgrade the policy, followig Az CLI command can be used: 
```az vmss update --set upgradePolicy.mode=Automatic -g <resource group name> -n <vmss name>```
