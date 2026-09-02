# Microsoft SQL Deployment

## Overview

The **Microsoft SQL Deployment** task deploys database changes to Azure SQL Database, Azure SQL Managed Instance, or SQL Server from your Azure Pipelines build or release. You can deploy from a pre-built DACPAC file, build and deploy directly from a SQL project (`.sqlproj`), or execute a T-SQL migration script — all from Windows or Linux agents without any manual tool installation.

## Prerequisites

### Target Database
The target database server must already exist. The task deploys schema changes to an existing database but does not create the server itself.

### Tools Required on the Agent
The task discovers and installs the tools it needs automatically:
- **SqlPackage** (for DACPAC and SQL project deployments) is found via the dotnet global tool, DacFramework MSI on Windows, or PATH. If you need to install it manually: `dotnet tool install -g microsoft.sqlpackage`
- **go-sqlcmd** (for `.sql` script execution) is found on PATH or auto-installed at runtime. No manual setup needed.
- **.NET SDK** (only when building a `.sqlproj`) is required to compile the project. Use the `UseDotNet@2` task to install it if not already present on the agent.

---

## Parameters

### Required

| Parameter | Description |
|---|---|
| **action** | The action to perform: `publish` (deploy schema), `script` (generate change script), `deployReport` (generate deployment report XML), or `sqlScript` (execute a `.sql` file). |
| **path** | Path to a `.dacpac`, `.sqlproj`, or `.sql` file. The file type is detected automatically from the extension. |
| **connectionString** | Full connection string for the target database. Store sensitive values as secret pipeline variables (e.g. `$(SqlConnectionString)`). |

### Optional

| Parameter | Description |
|---|---|
| **azureSubscription** | Azure Resource Manager service connection. Required for firewall rule management. When set with `Authentication=Active Directory Default`, the task uses the service connection identity for database authentication. |
| **publishProfile** | Path to a SqlPackage publish profile `.xml` file. Values in `additionalArguments` take precedence. |
| **additionalArguments** | Additional arguments passed to SqlPackage or sqlcmd. |
| **buildArguments** | Additional arguments passed to `dotnet build` when path points to a `.sqlproj` file (e.g. `--configuration Release`). |
| **sqlpackagePath** | Override the SqlPackage executable path. When not set, the task searches via dotnet tool, DacFramework MSI (Windows), then PATH. |
| **sqlcmdPath** | Override the sqlcmd executable path. When not set, the task uses go-sqlcmd from PATH or auto-installs it. |
| **firewallRuleManagement** | When `true`, temporarily adds a firewall rule for the agent IP and removes it after deployment. Only applies to Azure SQL Database logical servers. Defaults to `true` when `azureSubscription` is provided *and* the target is an Azure SQL Database logical server. Set to `false` for private VNet or on-premises deployments. |

### Output Variables

| Variable | Description |
|---|---|
| **SqlDeploymentOutputFile** | Path to the generated output file for `script` and `deployReport` actions. |

---

## Authentication

The task authenticates to the database using the `connectionString` input. Set the `Authentication` keyword in the connection string to select the auth method:

### SQL Authentication
```
Server=myserver.database.windows.net;Database=mydb;User ID=myuser;Password=$(SqlPassword);
```

### Active Directory Default (Managed Identity / Workload Identity)
Connects using the agent's ambient identity (managed identity, workload identity, Azure CLI login). When `azureSubscription` is also set, the task acquires a token from the service connection and uses it for the deployment.
```
Server=myserver.database.windows.net;Database=mydb;Authentication=Active Directory Default;
```

### Active Directory Service Principal
```
Server=myserver.database.windows.net;Database=mydb;Authentication=Active Directory Service Principal;User ID=<clientId>;Password=$(ClientSecret);
```
> **Note for SQL script execution (`.sql` files)**: When using SP auth without `azureSubscription`, the `User ID` field must include the tenant ID in `clientId@tenantId` format so go-sqlcmd can resolve the tenant. When `azureSubscription` is set, the tenant is resolved automatically.

### Active Directory Password
```
Server=myserver.database.windows.net;Database=mydb;Authentication=Active Directory Password;User ID=user@domain.com;Password=$(Password);
```

### Active Directory Integrated
```
Server=myserver.database.windows.net;Database=mydb;Authentication=Active Directory Integrated;
```

> Supported for `.dacpac` and `.sqlproj` deployments, which SqlPackage authenticates using the
> signed-in Windows account.
>
> **Not implemented for the `sqlScript` action.** sqlcmd does not implement this method and falls
> back to `Active Directory Default`, so the script runs under whichever identity the
> [DefaultAzureCredential chain](https://learn.microsoft.com/dotnet/api/azure.identity.defaultazurecredential)
> resolves — an environment variable, a managed identity or an `az login` session — rather than the
> signed-in domain account. The task warns when this happens. Use `Active Directory Service
> Principal` or `Active Directory Managed Identity` to state the identity explicitly.
>
> Supplying `azureSubscription` does not change the identity for this authentication type; the
> connection string is passed through so the tool resolves it.

### Active Directory Managed Identity
For user-assigned managed identity, include the client ID:
```
Server=myserver.database.windows.net;Database=mydb;Authentication=Active Directory Managed Identity;User ID=<clientId>;
```

---

## Usage Examples

### Deploy a DACPAC
```yaml
- task: MicrosoftSqlDeployment@1
  inputs:
    action: publish
    path: $(Build.ArtifactStagingDirectory)/MyDatabase.dacpac
    connectionString: $(SqlConnectionString)
```

### Deploy using Azure service connection with firewall management
```yaml
- task: MicrosoftSqlDeployment@1
  inputs:
    action: publish
    path: $(Build.ArtifactStagingDirectory)/MyDatabase.dacpac
    connectionString: 'Server=myserver.database.windows.net;Database=mydb;Authentication=Active Directory Default;'
    azureSubscription: my-azure-service-connection
```

### Build and deploy a SQL project
```yaml
- task: UseDotNet@2
  inputs:
    version: '8.x'
- task: MicrosoftSqlDeployment@1
  inputs:
    action: publish
    path: $(Build.SourcesDirectory)/src/MyDatabase/MyDatabase.sqlproj
    connectionString: $(SqlConnectionString)
```

### Execute a SQL migration script
```yaml
- task: MicrosoftSqlDeployment@1
  inputs:
    action: sqlScript
    path: $(Build.SourcesDirectory)/migrations/V1.0__initial.sql
    connectionString: $(SqlConnectionString)
    firewallRuleManagement: false
```

### Generate a deployment script for review
```yaml
- task: MicrosoftSqlDeployment@1
  inputs:
    action: script
    path: $(Build.ArtifactStagingDirectory)/MyDatabase.dacpac
    connectionString: $(SqlConnectionString)
    additionalArguments: '/OutputPath:"$(Build.ArtifactStagingDirectory)/deploy-script.sql"'
- publish: $(Build.ArtifactStagingDirectory)/deploy-script.sql
  artifact: deployment-script
```

> Quote any path passed in `additionalArguments`. Arguments are split on unquoted spaces, so an
> unquoted path breaks if the agent's working directory contains a space.

---

## Supported Actions

| Action | File types | Description |
|---|---|---|
| `publish` | `.dacpac`, `.sqlproj` | Deploy schema changes to the target database |
| `script` | `.dacpac`, `.sqlproj` | Generate a SQL change script without applying it |
| `deployReport` | `.dacpac`, `.sqlproj` | Generate an XML report of changes that would be applied |
| `sqlScript` | `.sql` | Execute a T-SQL script against the target database |

---

## Firewall Rule Management

When `azureSubscription` is set and `firewallRuleManagement` is `true` (the default), the task:
1. Detects the agent's public IP address by probing the SQL server
2. Adds a temporary firewall rule via the Azure ARM API
3. Removes the rule after deployment completes (always, even on failure)

This requires the service connection to have `Microsoft.Sql/servers/firewallRules/write` and `Microsoft.Sql/servers/firewallRules/delete` permissions on the SQL server.

> Firewall rules exist only for Azure SQL Database logical servers, which are
> `Microsoft.Sql/servers` resources. Managed Instance, Fabric SQL and SQL Server on a virtual
> machine or on premises have no Azure SQL firewall rules, so the default is `false` for those
> targets even when `azureSubscription` is supplied for authentication. Requesting it explicitly
> for one of them fails with a message naming this limitation.

Disable this for agents inside a private VNet or on-premises deployments:
```yaml
firewallRuleManagement: false
```

---

## SqlPackage Discovery Order

1. User-specified `sqlpackagePath` input
2. Dotnet global tool (`~/.dotnet/tools/sqlpackage`)
3. DacFramework MSI install path (Windows only, e.g. `C:\Program Files\Microsoft SQL Server\...\DAC\bin\SqlPackage.exe`)
4. System PATH

If SqlPackage is not found, install it: `dotnet tool install -g microsoft.sqlpackage`

---

## Known Limitations and Notes

### SQL scripts fail the task on error by default
The task runs `.sql` files with sqlcmd's `-b` flag, so a statement that fails with severity 11 or
higher aborts the script and fails the task. Without it, sqlcmd prints the error but still exits 0,
which would report a half-applied migration as a successful deployment. `PRINT` output and
informational messages (severity 10 and below) are unaffected.

To opt out and let a script continue past errors, state your own intent in `additionalArguments`:

```yaml
additionalArguments: '--exit-on-error=false'
```

The task only supplies `-b` when `additionalArguments` does not already mention `-b` or
`--exit-on-error`.

### Service Principal auth for `.sql` scripts requires a tenant ID
When using `Authentication=Active Directory Service Principal` in the connection string for `.sql` file execution, go-sqlcmd needs the tenant ID to authenticate. If you set `azureSubscription`, the tenant ID is resolved automatically from the service connection — no extra configuration needed. If you do **not** set `azureSubscription`, you must include the tenant ID directly in the `User ID` field using the format `clientId@tenantId`:

```
User ID=11111111-2222-3333-4444-555555555555@xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx;
```

Without the tenant ID and without `azureSubscription`, the task will fail with an authentication error.

### `azureSubscription` provides identity for DACPAC/sqlproj, not always for `.sql` scripts
When using `Authentication=Active Directory Default` with `azureSubscription`, the task acquires a token from the service connection and passes it to SqlPackage via `/AccessToken`. For `.sql` script execution with go-sqlcmd, the service connection credentials are injected as environment variables so go-sqlcmd uses the same identity. Service Principal and WorkloadIdentityFederation connections are fully supported. ManagedServiceIdentity connections use the agent's own managed identity.

### SQL script execution uses go-sqlcmd, not ODBC sqlcmd
The task installs and uses [go-sqlcmd](https://github.com/microsoft/go-sqlcmd) for `.sql` file execution. If the agent has the ODBC sqlcmd (from SQL Server or mssql-tools) on PATH, the task automatically detects this and installs go-sqlcmd instead, because go-sqlcmd is required for cross-platform AAD authentication support.

### `.sqlproj` builds require SDK-style projects
Only SQL projects using `Microsoft.Build.Sql` (SDK-style) are supported for build. Legacy `.sqlproj` projects (SSDT-style) must be pre-compiled to a DACPAC outside this task.

---

## Troubleshooting

**SqlPackage not found**: Install via `dotnet tool install -g microsoft.sqlpackage` or specify the path using the `sqlpackagePath` input.

**Firewall rule management fails**: Ensure the service connection has write/delete permissions on SQL firewall rules. Alternatively, set `firewallRuleManagement: false` and manage network access separately.

**DotnetNotFound when building .sqlproj**: Add the `UseDotNet@2` task before this task to install the .NET SDK.

**Active Directory auth fails for SQL scripts**: Ensure `azureSubscription` is set, or include the tenant ID in the connection string `User ID` field as `clientId@tenantId` for Service Principal auth.
