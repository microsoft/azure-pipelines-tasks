# Azure CLI

## Overview
This task supports running [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/overview) commands on Cross platform agents running Windows, Linux or Mac.

### What's new in Version 2.0
- Supports running PowerShell and PowerShell Core script.
- PowerShell Core script works with Xplat agents  (Windows, Linux or OSX), make sure the agent has PowerShell version 6 or more.
- Powershell script works only with Windows agent, make sure the agent has PowerShell version 5 or below.

## Contact Information
Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task
The following pre-requisites need to be setup in the target machine(s) for the task to work properly.

#### **Azure Subscription**
To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the settings section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.
- For Azure Classic resources use 'Azure' endpoint type with Certificate or Credentials based authentication. If you are using credentials based auth, ensure that the credentials are for a [**work account**](https://azure.microsoft.com/en-in/pricing/member-offers/msdn-benefits-details/work-accounts-faq/) because Microsoft accounts like [**joe@live.com**](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/DeployAzureResourceGroup) or [**joe@hotmail.com**](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/DeployAzureResourceGroup) are not supported.
- For [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/), use 'Azure Resource Manager' endpoint type, for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

#### **Azure CLI**
The task needs the Azure CLI version to be installed on the automation agent, and the details are available [here](https://azure.microsoft.com/en-us/documentation/articles/xplat-cli-install/).
If an agent is already running on the machine on which the Azure CLI is installed, ensure to restart the agent to ensure all the relevant environment variables are updated.

## Parameters of the task
The task is used to run Azure CLI commands on Cross platform agents running Windows, Linux or Mac . The mandatory fields are highlighted with a *.

* **Azure Connection Type**\*: Specify Azure endpoint type, for Azure Classic resources use 'Azure' endpoint, for Azure ARM resources use 'Azure Resource Manager' endpoint. This parameter is shown only when the selected task version is 0.* as Azure CLI task v1.0 supports only Azure Resource Manager (ARM) subscriptions

* **Azure Subscription**\*: Select the Azure Subscription where the Azure CLI commands have to be executed. If none exists, then click on the **Manage** link, to navigate to the Services tab in the Administrators panel. In the tab click on **New Service Endpoint** and select **Azure Resource Manager** from the dropdown.

* **Script Type**\*: Select the type of script to be executed on the agent. Task supports four types: Batch / Shell / PowerShell / PowerShell Core scripts, default selection being empty. Select Shell/PowerShell Core script when running on Linux agent or Batch/PowerShell/PowerShell Core script when running on Windows agent. PowerShell Core script can run on cross-platform agents (Linux, macOS, or Windows)

* **Script Location**\*: Select the mode of providing the script. Task supports two modes: one as a Script Path to a linked artifact and another as an inline script, default selection being the "Script Path"

* **Script Path**\*: When using Windows based agent, specify the path to the .bat , .cmd , .ps1 script whereas when using Linux based agent, specify the path to the .sh , .ps1 script you want to run. The path must be a fully qualified path or a valid path relative to the default working directory. Note: You must also specify the respective script type in above field.

* **Inline Script**\*: Specify the script inline here. When using Windows based agent use batch or PowerShell or PowerShell Core scripting whereas use shell or PowerShell Core scripting when using Linux based agents. Note: You must also specify the respective script type in above field.

* **Script Arguments**: Specify arguments to pass to the script.

* **Working folder**: Specify the working directory in which you want to run the script. If you leave it empty, the working directory is the folder where the script is located.

## Security

### Command injection through `scriptArguments`

Values substituted into the **Script Arguments** input (also exposed as the YAML alias `arguments`) are appended to the shell invocation that runs your script. If a YAML template parameter spliced into `scriptArguments` contains shell metacharacters, those characters are interpreted by the shell.

### Argument sanitization (work item 75787)

To mitigate this class of issue the task can sanitize `scriptArguments` **before** `az login` and **before** the script tool is spawned, using the same sanitizer that the BashV3 and PowerShell tasks use (work item [#75787](https://aka.ms/ado/75787)). Validation is gated by two layers:

#### Outer gate (per-pipeline)

| Pipeline feature | Default | Behavior |
| --- | --- | --- |
| `EnableAzureCliArgsValidation` | off | When false, the sanitizer is **not invoked at all**. When true, the sanitizer runs and the `AZP_75787_*` flags below decide its mode. |

The wrapper around the sanitizer emits an `ArgsValidationFailure` telemetry event on every exception (intentional `ArgsSanitizingError` block or unexpected error) with the error name and message, then rethrows so the task fails. To bypass validation entirely if a sanitizer regression is discovered, disable the outer `EnableAzureCliArgsValidation` flag.

#### Inner mode flags (org/agent-wide)

| Feature flag | Default | Behavior |
| --- | --- | --- |
| `AZP_75787_ENABLE_NEW_LOGIC` | off | If sanitization removes any character, the task fails with `ScriptArgsSanitized`. |
| `AZP_75787_ENABLE_NEW_LOGIC_LOG` | off | Audit-only mode. The task emits a warning with `ScriptArgsSanitized` and continues. |
| `AZP_75787_ENABLE_COLLECT` | off | Telemetry only. No warning, no failure. |

When `EnableAzureCliArgsValidation` is on but all three `AZP_75787_*` flags are off, the sanitizer short-circuits and does nothing.

The sanitizer uses a per-`scriptType` **allowlist** and, where applicable, pre-expands environment variables that the target shell would expand:

| `scriptType` | Allowlist (everything else is treated as a violation) | Pre-expansion |
| --- | --- | --- |
| `bash` | `a-zA-Z0-9 \ _ ' " - = / : . * + %` | `$VAR` / `${VAR}` is resolved from the process env before sanitization, so a value-injected secret like `VAR=";rm -rf /"` is also caught. |
| `pscore`, `ps` | `\w \ ` `` ` `` ` _ ' " - = / : . * , + ~ ? % \n #`, plus `` ` `` as the escape symbol and `$true` / `$false` (case-insensitive) | `$env:VAR` and `${env:VAR}` references are resolved from the process env before sanitization. PowerShell-native syntax such as `-AzureClientSecret $env:servicePrincipalKey`, `-MyBoolean $True`, multi-line `arguments: >` blocks, and backtick-escaped characters all pass. |
| `batch` (and anything else) | `a-zA-Z0-9 \ _ ' " - = / : . * + %` | None — the literal `scriptArguments` is sanitized as written. |

For `pscore` / `ps`, characters such as `@`, `(`, `)`, `{`, `}` are still flagged because they let the shell interpret subsequent text in ways that a static allowlist cannot reason about. If you legitimately need one of them, prefix it with a backtick (`` ` ``) to escape it, or move the value into an `env:` block on the task and reference it from inside your script.

When a violation is detected, the error message lists the distinct offending characters (whitespace such as `\n`, `\r`, `\t` is omitted from the message but is still counted in telemetry).

`inlineScript` is *not* validated — inline scripts are arbitrary code that the pipeline author intentionally wrote. `scriptPath` and `cwd` are also not validated; they are path inputs, not shell-spliced.

### Azure CLI configuration isolation (`useGlobalConfig`)

By default (`useGlobalConfig: false`) each task invocation runs with its own isolated `AZURE_CONFIG_DIR`. A fresh, unpredictably-named directory is created under `Agent.TempDirectory` when the task starts and is deleted when the task finishes. This is a security hardening: it prevents an earlier step on the same (typically self-hosted) agent from pre-seeding a poisoned Azure CLI `config` file (for example `extension.index_url` / `use_dynamic_install`) that would otherwise execute under the service-connection identity when the task invokes `az`.

**Impact on configuration persistence:** because the directory is per-invocation and removed at task end, configuration written in one Azure CLI task is **not** shared with other Azure CLI tasks in the same job. This applies to `az configure --defaults`, `az config set`, and `az extension add`. A second task that relies on defaults from the first (for example `az ml workspace show` without `--workspace-name`) will fail with an error such as `one of the following arguments are required: --workspace-name/-w`.

To share Azure CLI configuration across tasks, use one of the following:

- Re-run the configuration command (for example `az configure --defaults ...`) in each Azure CLI task, or
- Pass the values explicitly on each command (for example `--resource-group`, `--workspace-name`), or set the corresponding `AZURE_DEFAULTS_*` environment variables on the task, or
- Set `useGlobalConfig: true` so the task uses the shared global Azure CLI profile (`~/.azure`). Note that on self-hosted agents the global profile can persist across runs on the same agent, which is a broader scope than the per-task temp directory; on Microsoft-hosted agents the VM is fresh each run.

> **Note:** This per-invocation isolation was introduced together with the task dependency/version updates in the 2.277.x range. Previously the task pointed `AZURE_CONFIG_DIR` at a fixed shared path (`$(Agent.TempDirectory)/.azclitask`), so defaults did carry across tasks. That cross-task persistence is intentionally no longer guaranteed unless `useGlobalConfig: true` is set.

* **Fail on standard error**: Select this check box if you want the build to fail if errors are written to the StandardError stream.

* **Access service principal details in script**: Select this check box if you want to add service principal id , service principal key and tenantId of the Azure endpoint to the script's execution environment. You can use variables: `servicePrincipalId`, `servicePrincipalKey` and `tenantId` in your script. This is honored only when the Azure endpoint has Service Principal authentication scheme. \
\
Syntax to access environment variables based on script type.\
*Powershell script:* `$env:servicePrincipalId`\
*Batch script:* `%servicePrincipalId%` \
*Shell script:* `$servicePrincipalId`