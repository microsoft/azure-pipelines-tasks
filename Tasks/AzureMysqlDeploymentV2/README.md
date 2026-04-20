# Azure Database for MySQL Flexible Server Deployment (V2)

## Overview

This task deploys scripts to [Azure Database for MySQL Flexible Server](https://learn.microsoft.com/azure/mysql/flexible-server/overview). You can deploy using a SQL script file or by writing the script inline.

V2 replaces V1, which targeted the now-retiring Azure Database for MySQL Single Server. V2 uses the Flexible Server resource provider (`Microsoft.DBforMySQL/flexibleServers`) and its management APIs.

## Contact Information

Please report a problem at the [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work. You can also share feedback about the task, like what additional functionality should be added or what other tasks you would like to have, at the same place.


## Prerequisites

The following prerequisites need to be set up for the task to work properly.

### Azure Subscription

To deploy to Azure Database for MySQL, an Azure subscription must be linked to Azure DevOps using the Service Connections tab in the project settings. Use the 'Azure Resource Manager' ([ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/)) endpoint type. For details, follow the steps [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

### Azure Database for MySQL Flexible Server

This task expects an [Azure Database for MySQL Flexible Server](https://learn.microsoft.com/azure/mysql/flexible-server/overview) resource to already exist in the [Azure portal](https://portal.azure.com/). The task can create a new database and run MySQL commands, but it does not create the server itself.

### MySQL Client on the Agent

- **Windows Agent:** Use this [script](https://aka.ms/window-mysqlcli-installer) to install the MySQL client.
- **Linux Agent:** Run `apt-get install mysql-client`.


## Parameters

Parameters listed with a \* are required.

### General

| Parameter              | Required | Description                                                                                   |
|------------------------|----------|-----------------------------------------------------------------------------------------------|
| Display name           | Yes      | A name to identify the task among others in your pipeline.                                    |
| Azure subscription     | Yes      | The Azure subscription where the MySQL Flexible Server resource is present.                   |

### DB Details

| Parameter              | Required | Description                                                                                                                                                  |
|------------------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Host name              | Yes      | Server name of the Flexible Server. Example: `fabrikam.mysql.database.azure.com`. Same value used for "Hostname" in MySQL Workbench.                         |
| Database name          | No       | Name of the database on which the script runs. The script can also create the database.                                                                      |
| Server admin login     | Yes      | Flexible Server supports native MySQL authentication. Use the admin login directly. Example: `bbo1` (no `@servername` suffix needed).                        |
| Password               | Yes      | Administrator password for the Flexible Server. You can reset it from the [Azure portal](https://learn.microsoft.com/azure/mysql/flexible-server/how-to-manage-server-portal). |

### Deployment Package

| Parameter                  | Required | Description                                                                                                                                         |
|----------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| Type                       | Yes      | Choose between **Script File** or **Inline Script**.                                                                                                |
| Script path (Script File)  | Yes      | Full path of the `.sql` file. Supports UNC paths and predefined system variables like `$(agent.releaseDirectory)`.                                  |
| Inline script (Inline)     | Yes      | The SQL statements to execute directly.                                                                                                             |
| Additional MySQL options   | No       | Extra options for the MySQL CLI, e.g., output format (`--html`, `--xml`) or `--quick` for large result sets.                                        |

### Firewall

| Parameter                      | Required | Description                                                                                                           |
|--------------------------------|----------|-----------------------------------------------------------------------------------------------------------------------|
| IP detection method            | Yes      | How to detect the agent's IP for firewall access. Options: `AutoDetect` or `IPAddressRange`.                          |
| Start IP address (Range mode)  | Yes      | Start of the IP range to whitelist.                                                                                   |
| End IP address (Range mode)    | Yes      | End of the IP range to whitelist.                                                                                     |
| Delete rule after task ends    | No       | If enabled, the firewall rule created by this task is removed after execution.                                        |


---


## What Changed from V1 to V2

This section documents the changes from V1 (Single Server) to V2 (Flexible Server).

### Why V2?

Azure Database for MySQL Single Server is on the retirement path. **Flexible Server** is the recommended deployment model going forward. V2 targets the Flexible Server resource provider (`Microsoft.DBforMySQL/flexibleServers`).


### File Changes Summary

| File                                     | Change Type  | Description                                                                     |
|------------------------------------------|--------------|---------------------------------------------------------------------------------|
| `azure-arm-mysql-flexible.ts`            | **New**      | Custom ARM client for Flexible Server API (`2021-12-01-preview`)                |
| `task.json`                              | **Modified** | Version bump to 2.x, Flexible Server strings, data source, Node10 removed      |
| `task.loc.json`                          | **Modified** | Localization template updated to match `task.json`                              |
| `operations/MysqlServerOperations.ts`    | **Modified** | Swapped management client import to Flexible Server client                      |
| `operations/FirewallOperations.ts`       | **Modified** | Swapped management client import to Flexible Server client                      |
| `sql/MysqlClient.ts`                     | **Modified** | New stdin-piped file execution, inline/file branching, username format change   |
| `azuremysqldeploy.ts`                    | **Modified** | Debug messages updated to reference "flexible server"                           |
| `package.json`                           | **Modified** | Name changed to `vsts-tasks-azuremysql-v2`; description updated                |
| `operations/MysqlUtility.ts`              | Minor        | Trailing newline fix only                                                       |
| `make.json`                              | Minor        | Trailing newline fix only                                                       |
| `Tests/L0.ts`                            | **Modified** | Suite name updated to V2; refactored to async/await, removed try/catch wrappers |
| `Tests/mock_utils.ts`                    | **Modified** | API paths updated to `flexibleServers` and `2021-12-01-preview`                 |
| `Tests/package.json`                     | **Modified** | Name and description updated for V2                                             |
| `Tests/ToolPathOperationsL0Tests.ts`     | Minor        | Trailing newline fix only                                                       |
| `models/AzureMysqlTaskParameter.ts`      | Identical    | No changes                                                                      |
| `models/Firewall.ts`                     | Identical    | No changes                                                                      |
| `models/FirewallConfiguration.ts`        | Identical    | No changes                                                                      |
| `models/MysqlServer.ts`                  | Identical    | No changes                                                                      |
| `operations/ToolPathOperations.ts`       | Identical    | No changes                                                                      |
| `sql/ISqlClient.ts`                      | Identical    | No changes                                                                      |
| `Tests/FirewallOperationTests.ts`        | Identical    | No changes                                                                      |
| `Tests/FirewallOperationsL0Tests.ts`     | Identical    | No changes                                                                      |
| `Tests/MysqlClientTests.ts`             | Identical    | No changes                                                                      |
| `Tests/MysqlClientL0Tests.ts`           | Identical    | No changes                                                                      |
| `Tests/MysqlServerOperationsL0Tests.ts`  | Identical    | No changes                                                                      |
| `Tests/ToolPathOperationTests.ts`        | Identical    | No changes                                                                      |
| `Window-MysqlCli-Installer.ps1`         | Identical    | No changes                                                                      |


### Detailed Changes

#### 1. New File: `azure-arm-mysql-flexible.ts`

Custom Azure ARM client targeting the MySQL Flexible Server management API. Replaces the legacy `AzureMysqlManagementClient` from `azure-pipelines-tasks-azure-arm-rest/azure-arm-mysql`.

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


#### 3. Operations Layer: `MysqlServerOperations.ts` & `FirewallOperations.ts`

| Aspect                     | V1 (Single Server)                                     | V2 (Flexible Server)                                        |
|----------------------------|---------------------------------------------------------|--------------------------------------------------------------|
| Import source              | `azure-pipelines-tasks-azure-arm-rest/azure-arm-mysql`  | Local `../azure-arm-mysql-flexible`                          |
| Client class               | `AzureMysqlManagementClient`                            | `AzureMysqlFlexibleServerManagementClient`                   |
| JSDoc / debug messages     | Reference "mysql server"                                | Updated to "mysql flexible server"                           |
| Business logic             | —                                                       | Unchanged (compatible interface)                             |


#### 4. SQL Execution: `sql/MysqlClient.ts`

This file has the most significant behavioral change.

| Aspect                     | V1 (Single Server)                                     | V2 (Flexible Server)                                        |
|----------------------------|---------------------------------------------------------|--------------------------------------------------------------|
| New imports                | —                                                       | `fs` and `child_process` added                               |
| Username comment           | —                                                       | "Flexible Server uses username without @servername suffix"   |
| File-based SQL execution   | `-e "source <filepath>"` (interactive-only, unreliable) | `_executeSqlScriptFromFile()` — pipes file via stdin         |
| Inline SQL execution       | `-e "..."` flag                                         | Unchanged                                                    |
| `_getFileSourceArgument()` | Handles both inline and file-based SQL                  | Simplified — only handles inline SQL                         |
| `executeSqlCommand()`      | Always calls `_executeSqlScript(arg + fileSource)`      | Branches: inline → `_executeSqlScript`, file → `_executeSqlScriptFromFile` |

**Why this matters:** The V1 `source` command only works in interactive MySQL CLI sessions. In automated pipeline execution it can fail silently. V2 pipes file content through stdin via `child_process.spawn()`, which works reliably in all execution modes.


### Migration Guide

| #  | Topic            | Details                                                                                          |
|----|------------------|--------------------------------------------------------------------------------------------------|
| 1  | Server type      | V2 only works with **Flexible Server**. If still using Single Server, continue with V1.          |
| 2  | Username format  | Use plain username (`bbo1`) instead of `username@servername` (`bbo1@fabrikam`).                   |
| 3  | Node10 removed   | V2 requires Node16 or Node20 agent execution handlers.                                           |
| 4  | File-based SQL   | Now uses stdin piping instead of `source` command for more reliable automated execution.          |
