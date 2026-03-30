# Azure Database for MySQL Flexible Server Deployment


## Overview

The task is used for deploying to Azure Database for MySQL Flexible Server. There are two ways to deploy, either using a script file or writing the script in our inline editor.

This V2 task targets Azure Database for MySQL Flexible Server, which is the recommended deployment model for MySQL on Azure. Azure Database for MySQL Single Server is on the retirement path — V2 replaces V1 to align with the Flexible Server resource provider and APIs.


## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work. You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.


## Pre-requisites for the Task

The following pre-requisites need to be setup for the task to work properly.

#### Azure Subscription

To deploy to Azure Database for MySQL, an Azure subscription has to be linked to Team Foundation Server or to Azure DevOps using the Service connections tab in the settings section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.
Use 'Azure Resource Manager'([ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/)) endpoint type; for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

#### Azure Database for MySQL Flexible Server Resource

This task expects that the Azure resource for [Azure Database for MySQL Flexible Server](https://learn.microsoft.com/azure/mysql/flexible-server/overview) is already available in the [Azure portal](https://portal.azure.com/). The task can create a new database along with other MySQL commands but doesn't create the server.

#### MySQL Client in Agent Box

This task expects MySQL client must be in agent box:
- **Windows Agent:** Use this [script file](https://aka.ms/window-mysqlcli-installer) to install MySQL client.
- **Linux Agent:** Run command `apt-get install mysql-client` to install MySQL client.


## Parameters of the Task

The parameters of the task are described in detail, including examples, to show how to input the parameters. Parameters listed with a \* are required.

#### General

| Parameter              | Required | Description                                                                                   |
|------------------------|----------|-----------------------------------------------------------------------------------------------|
| Display name           | Yes      | A name to identify the task among others in your pipeline.                                    |
| Azure subscription     | Yes      | The Azure subscription where the MySQL Flexible Server resource is present.                   |

#### DB Details

| Parameter              | Required | Description                                                                                                                                                  |
|------------------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Host name              | Yes      | Server name of the Flexible Server. Example: `fabrikam.mysql.database.azure.com`. Same value used for "Hostname" in MySQL Workbench.                         |
| Database name          | No       | Name of the database on which the script runs. The script can also create the database.                                                                      |
| Server admin login     | Yes      | Flexible Server supports native MySQL authentication. Use the admin login directly. Example: `bbo1` (no `@servername` suffix needed).                        |
| Password               | Yes      | Administrator password for the Flexible Server. You can reset it from the [Azure portal](https://learn.microsoft.com/azure/mysql/flexible-server/how-to-manage-server-portal). |

#### Deployment Package

| Parameter                  | Required | Description                                                                                                                                         |
|----------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| Type                       | Yes      | Choose between **Script File** or **Inline Script**.                                                                                                |
| Script path (Script File)  | Yes      | Full path of the `.sql` file. Supports UNC paths and predefined system variables like `$(agent.releaseDirectory)`.                                  |
| Inline script (Inline)     | Yes      | The SQL statements to execute directly.                                                                                                             |
| Additional MySQL options   | No       | Extra options for the MySQL CLI, e.g., output format (`--html`, `--xml`) or `--quick` for large result sets.                                        |

#### Firewall

| Parameter                      | Required | Description                                                                                                           |
|--------------------------------|----------|-----------------------------------------------------------------------------------------------------------------------|
| IP detection method            | Yes      | How to detect the agent's IP for firewall access. Options: `AutoDetect` or `IPAddressRange`.                          |
| Start IP address (Range mode)  | Yes      | Start of the IP range to whitelist.                                                                                   |
| End IP address (Range mode)    | Yes      | End of the IP range to whitelist.                                                                                     |
| Delete rule after task ends    | No       | If enabled, the firewall rule created by this task is removed after execution.                                        |


---


## Changes from V1 to V2 (Flexible Server Support)

This section documents all changes made to create AzureMysqlDeploymentV2 from V1 and how support for Azure Database for MySQL Flexible Server was added.

### Why V2?

Azure Database for MySQL Single Server is on the retirement path. Azure Database for MySQL **Flexible Server** is the recommended deployment model going forward. V2 targets the Flexible Server resource provider (`Microsoft.DBforMySQL/flexibleServers`) and its APIs.


### Summary of All File Changes

| File                                     | Change Type  | Description                                                                     |
|------------------------------------------|--------------|---------------------------------------------------------------------------------|
| `azure-arm-mysql-flexible.ts`            | **New**      | Custom ARM client for Flexible Server API (`2021-12-01-preview`)                |
| `task.json`                              | **Modified** | Version bump to 2.x, Flexible Server strings, data source, Node10 removed      |
| `task.loc.json`                          | **Modified** | Localization template updated to match `task.json`                              |
| `operations/MysqlServerOperations.ts`    | **Modified** | Swapped management client import to Flexible Server client                      |
| `operations/FirewallOperations.ts`       | **Modified** | Swapped management client import to Flexible Server client                      |
| `sql/MysqlClient.ts`                     | **Modified** | New stdin-piped file execution, inline/file branching, username format change   |
| `tsconfig.json`                          | **Modified** | Added `skipLibCheck: true`                                                      |
| `azuremysqldeploy.ts`                    | Unchanged    | Only comment updates, no logic change                                           |
| `package.json`                           | Unchanged    | Same dependencies; name changed to `vsts-tasks-azuremysql-v2`                  |
| `models/AzureMysqlTaskParameter.ts`      | Unchanged    | Identical                                                                       |
| `models/Firewall.ts`                     | Unchanged    | Identical                                                                       |
| `models/FirewallConfiguration.ts`        | Unchanged    | Identical                                                                       |
| `models/MysqlServer.ts`                  | Unchanged    | Identical                                                                       |
| `operations/MysqlUtiliy.ts`              | Unchanged    | Identical                                                                       |
| `operations/ToolPathOperations.ts`       | Unchanged    | Identical                                                                       |
| `sql/ISqlClient.ts`                      | Unchanged    | Identical                                                                       |
| `Tests/` (all test files)               | Unchanged    | Identical                                                                       |
| `make.json`                              | Unchanged    | Identical                                                                       |
| `Window-MysqlCli-Installer.ps1`         | Unchanged    | Identical                                                                       |


### Detailed Changes

#### 1. New File — `azure-arm-mysql-flexible.ts`

A custom Azure ARM client targeting the MySQL Flexible Server management API. Replaces the legacy `AzureMysqlManagementClient` from `azure-pipelines-tasks-azure-arm-rest/azure-arm-mysql`.

| Class                                       | Purpose                                                                                      |
|---------------------------------------------|----------------------------------------------------------------------------------------------|
| `AzureMysqlFlexibleServerManagementClient`  | Extends `ServiceClient`. Sets API version to `2021-12-01-preview`. Exposes sub-clients below.|
| `FlexibleServerFirewallRules`               | `createOrUpdate`, `delete`, `get` for firewall rules. Async polling for HTTP 202 with retry. |
| `FlexibleMysqlServers`                      | `list` — enumerates all Flexible Servers in a subscription with `nextLink` pagination.       |

Key API path change: `Microsoft.DBforMySQL/servers/` → `Microsoft.DBforMySQL/flexibleServers/`


#### 2. `task.json` Changes

| Field                      | V1 (Single Server)                                     | V2 (Flexible Server)                                        |
|----------------------------|---------------------------------------------------------|--------------------------------------------------------------|
| Major version              | `1`                                                     | `2`                                                          |
| Task description           | "Azure Database for MySQL"                              | "Azure Database for MySQL Flexible Server"                   |
| `dataSourceBindings`       | `AzureMysqlServers`                                     | `AzureMysqlFlexibleServers`                                  |
| Username format example    | `bbo1@fabrikam` (requires `@serverName` suffix)         | `bbo1` (plain username, no suffix)                           |
| SqlPassword help link      | `howto-create-manage-server-portal`                     | `flexible-server/how-to-manage-server-portal`                |
| Node10 execution handler   | Present                                                 | Removed                                                      |
| Error messages             | 22 messages referencing "MySQL server"                  | All updated to "MySQL Flexible Server"; 1 new message added  |


#### 3. Operations Layer — `MysqlServerOperations.ts` & `FirewallOperations.ts`

| Aspect                     | V1 (Single Server)                                     | V2 (Flexible Server)                                        |
|----------------------------|---------------------------------------------------------|--------------------------------------------------------------|
| Import source              | `azure-pipelines-tasks-azure-arm-rest/azure-arm-mysql`  | Local `../azure-arm-mysql-flexible`                          |
| Client class               | `AzureMysqlManagementClient`                            | `AzureMysqlFlexibleServerManagementClient`                   |
| JSDoc / debug messages     | Reference "mysql server"                                | Updated to "mysql flexible server"                           |
| Business logic             | —                                                       | Unchanged (compatible interface)                             |


#### 4. SQL Execution — `sql/MysqlClient.ts`

This file has the most significant **behavioral change**.

| Aspect                     | V1 (Single Server)                                     | V2 (Flexible Server)                                        |
|----------------------------|---------------------------------------------------------|--------------------------------------------------------------|
| New imports                | —                                                       | `fs` and `child_process` added                               |
| Username comment           | —                                                       | "Flexible Server uses username without @servername suffix"   |
| File-based SQL execution   | `-e "source <filepath>"` (interactive-only, unreliable) | `_executeSqlScriptFromFile()` — pipes file via stdin         |
| Inline SQL execution       | `-e "..."` flag                                         | Unchanged                                                    |
| `_getFileSourceArgument()` | Handles both inline and file-based SQL                  | Simplified — only handles inline SQL                         |
| `executeSqlCommand()`      | Always calls `_executeSqlScript(arg + fileSource)`      | Branches: inline → `_executeSqlScript`, file → `_executeSqlScriptFromFile` |

**Why this matters:** The V1 `source` command only works in interactive MySQL CLI sessions. In non-interactive/automated pipeline execution it can fail silently. V2 pipes file content through stdin via `child_process.spawn()`, which works correctly in all execution modes.


#### 5. `tsconfig.json`

| Setting                    | V1                                                      | V2                                                           |
|----------------------------|---------------------------------------------------------|--------------------------------------------------------------|
| `skipLibCheck`             | Not set                                                 | `true`                                                       |


### Migration Notes for Users

| #  | Topic            | Details                                                                                          |
|----|------------------|--------------------------------------------------------------------------------------------------|
| 1  | Server type      | V2 only works with **Flexible Server**. If using Single Server, continue using V1.               |
| 2  | Username format  | Use plain username (`bbo1`) instead of `username@servername` (`bbo1@fabrikam`).                   |
| 3  | Node10 removed   | This task requires Node16 or Node20 agent execution handlers.                                    |
| 4  | File-based SQL   | Now uses stdin piping instead of `source` command — more reliable in automated pipelines.        |
