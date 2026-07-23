# MicrosoftSqlDeploymentV1 - Complete Development Guide

**Status:** 2-Week Development Cycle Starting 2026-07-10  
**Purpose:** Build a cross-platform replacement for SqlAzureDacpacDeploymentV1  
**Repository:** microsoft/azure-pipelines-tasks  
**Reference Implementation:** Azure/sql-action (GitHub Action)

---

## Table of Contents

1. [Product Specification (EXACT from ADO Wiki)](#1-product-specification-exact-from-ado-wiki)
2. [SqlAzureDacpacDeploymentV1 - Current V1 Task Analysis](#2-sqlazuredacpacdeploymentv1---current-v1-task-analysis)
3. [Azure/sql-action - GitHub Action Analysis](#3-azuresql-action---github-action-analysis)
4. [Reusability Analysis](#4-reusability-analysis)
5. [Challenge Areas](#5-challenge-areas)
6. [Development Roadmap](#6-development-roadmap)

---

# 1. Product Specification (EXACT from ADO Wiki)

## 1.1 Overview / Summary

**What:** A new Azure DevOps pipeline task (MicrosoftSqlDeploymentV1) for deploying SQL schema changes and executing T-SQL scripts against Microsoft SQL targets. It replaces the existing SqlAzureDacpacDeploymentV1 task with cross-platform support, modern SqlPackage discovery, optional SQL project building, and streamlined authentication.

**Why:** The existing SqlAzureDacpacDeploymentV1 task is Windows-only, has broken SqlPackage discovery (does not find dotnet tool install or VS2022/VS2026 installs), lacks SQL project build support, and has accumulated years of unresolved user feedback (#15194, #18913, #15998). The GitHub azure/sql-action already supports cross-platform, .sqlproj build, and modern tooling ÔÇö ADO users deserve parity.

**Who:** DevOps engineers and database developers using Azure DevOps pipelines to deploy SQL schema and data changes to Azure SQL Database, Azure SQL Managed Instance, SQL Server (on-prem/VM), and SQL database in Microsoft Fabric.

## 1.2 Goals and Non-Goals

### Goals

The Azure DevOps Microsoft SQL deployment task is fundamentally a thin wrapper around SqlPackage and SQLCMD. While users can absolutely leverage these CLIs directly, the task promotes their visibility as capabilities within the Azure DevOps pipelines. The task also facilitates leveraging the service connection identities for Azure Active Directory authentication, as well as simplifies the firewall rule management within the pipeline run, lowering the barrier to entry for users in setting up CI/CD pipelines for SQL deployments.

- **Cross-platform:** Run on Windows and Linux agents (hosted and self-hosted)
- **Feature parity with azure/sql-action:** Support .dacpac, .sqlproj (build + deploy), and .sql file deployments
- **Modern SqlPackage discovery:** Prioritize dotnet tool install, fall back to DacFramework MSI on Windows only, allow explicit path override
- **Flexible authentication:** Support connection string, SQL auth, managed identity (via service connection), and Microsoft Entra ID methods
- **Explicit firewall control:** Allow firewall rule auto-provisioning to be explicitly disabled to support private VNet architectures
- **Deprecation path:** Provide a clear migration path from SqlAzureDacpacDeploymentV1 and formally deprecate SqlDacpacDeploymentOnMachineGroupV0, SqlServerDacpacDeployment, and SqlDacpacDeploy (WinRM)
- **Actionable errors:** Surface clear, diagnostic error messages that guide users to resolutions rather than masking root causes

### Non-Goals

- **Build-only mode for SQL projects:** The task will not support building a .sqlproj without deploying. Users should use dotnet build directly for build-only scenarios or use the DotNet CLI task.
- **Replacing sqlcmd as a general-purpose tool:** The task is for deployment, not ad-hoc querying.
- **Legacy .sqlproj format support:** Only SDK-style projects using Microsoft.Build.Sql are supported for .sqlproj build.
- **Azure Classic service connections:** The new task only supports Azure Resource Manager connections. Classic connections are end-of-life.
- **WinRM-based remote deployment:** Out of scope; use deployment groups or direct network access instead.

## 1.3 User Experience / Scenarios

### Scenario 1: DACPAC deployment with connection string (simplest)

A developer deploys a pre-built .dacpac to any SQL database using SQL auth. No Azure service connection is needed. The .dacpac can originate from any SQL project type.

```yaml
steps:
  - task: MicrosoftSqlDeployment@1
    inputs:
      action: 'publish'
      path: '$(Build.ArtifactStagingDirectory)/MyDatabase.dacpac'
      connectionString: 'Server=myserver.database.windows.net;Database=mydb;User ID=sqladmin;Password=$(SqlPassword);Encrypt=True;'
```

This scenario could be used in a CI/CD pipeline where the .dacpac is being deployed to a SQL container (sidecar/service container to the pipeline host runner).

### Scenario 2: SQL project build + deploy with service principal

A team uses a .sqlproj in their repo. The task builds the project and deploys using the Azure service connection's app registration identity (including adding and removing a JIT firewall rule on the database's server firewall with that identity). A separate step is not needed to authenticate with the Azure service connection. Firewall rule changes are not explicitly set, but when connectivity tests result in needing a firewall rule, the task will automatically manage it.

```yaml
steps:
  - task: MicrosoftSqlDeployment@1
    inputs:
      azureSubscription: 'my-service-connection-name'
      action: 'publish'
      path: './src/MyDatabase/MyDatabase.sqlproj'
      connectionString: 'Server=myserver.database.windows.net;Database=mydb;Authentication=Active Directory Default;'
```

### Scenario 3: SQL script execution on Linux agent

A team runs migration scripts against an Azure SQL Managed Instance from a Linux agent connected to the same VNet. Firewall rule changes are explicitly skipped.

```yaml
pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: MicrosoftSqlDeployment@1
    inputs:
      action: 'sqlScript'
      path: './migrations/V1.0.0__initial.sql'
      connectionString: 'Server=mymi.public.abc123.database.windows.net,3342;Database=mydb;User ID=sqladmin;Password=$(SqlPassword);Encrypt=True;'
      firewallRuleManagement: false
```

### Scenario 4: DACPAC deploy to private VNet with firewall disabled

A team deploys from a self-hosted agent inside a private VNet. Firewall auto-provisioning must be disabled.

```yaml
pool: 'my-private-pool'

steps:
  - task: MicrosoftSqlDeployment@1
    inputs:
      action: 'publish'
      path: '$(Pipeline.Workspace)/drop/MyDatabase.dacpac'
      connectionString: 'Server=myserver.database.windows.net;Database=mydb;Authentication=Active Directory Default;Encrypt=True;'
      firewallRuleManagement: false
```

### Scenario 5: Generate deployment script for review

A team generates a deployment script without applying it, for manual review in a gated release.

```yaml
steps:
  - task: MicrosoftSqlDeployment@1
    inputs:
      action: 'script'
      path: './artifacts/MyDatabase.dacpac'
      connectionString: 'Server=myserver.database.windows.net;Database=mydb;User ID=sqladmin;Password=$(SqlPassword);Encrypt=True;'
      additionalArguments: '/OutputPath:$(Build.ArtifactStagingDirectory)/deploy-script.sql'

  - publish: $(Build.ArtifactStagingDirectory)/deploy-script.sql
    artifact: deployment-script
```

### Scenario 6: SQL project deploy with publish profile and build arguments

```yaml
steps:
  - task: MicrosoftSqlDeployment@1
    inputs:
      action: 'publish'
      path: './src/MyDatabase/MyDatabase.sqlproj'
      connectionString: 'Server=myserver.database.windows.net;Database=mydb;User ID=sqladmin;Password=$(SqlPassword);Encrypt=True;'
      publishProfile: './src/MyDatabase/prod.publish.xml'
      buildArguments: '-c Release /p:TreatTSqlWarningsAsErrors=true'
```

### Scenario 7: Deploy to SQL database in Microsoft Fabric

```yaml
steps:
  - task: MicrosoftSqlDeployment@1
    inputs:
      action: 'publish'
      path: './artifacts/MyDatabase.dacpac'
      connectionString: 'Server=some-id.database.fabric.microsoft.com;Database=mydb;Authentication=Active Directory Default;Encrypt=True;'
      firewallRuleManagement: false
```

### Scenario 8: Deploy to on-prem SQL Server named instance with custom SqlPackage path

A team deploys to a named SQL Server instance on their corporate network from a self-hosted Windows agent. SqlPackage is installed in a non-standard location.

```yaml
pool: 'on-prem-agents'

steps:
  - task: MicrosoftSqlDeployment@1
    inputs:
      action: 'publish'
      path: '$(Pipeline.Workspace)/drop/MyDatabase.dacpac'
      connectionString: 'Server=DBSERVER01\PROD;Database=mydb;User ID=deployer;Password=$(SqlPassword);Encrypt=Optional;TrustServerCertificate=True;'
      sqlpackagePath: 'D:\Tools\SqlPackage\sqlpackage.exe'
      firewallRuleManagement: false
```

Named instances use the SERVER\Instance syntax in the connection string. The task passes the connection string directly to SqlPackage without parsing or modifying the server name. Firewall management is disabled because on-prem SQL Server does not have Azure-managed firewall rules.

## 1.4 Functional Requirements

### P0 ÔÇô Cross-platform support (Windows, Linux)

- The task MUST run on Windows and Linux agents (hosted and self-hosted)
- The task MUST NOT universally depend on Windows-only constructs: Windows registry, vswhere.exe, PowerShell modules (SqlServer/SQLPS), or Invoke-Sqlcmd
- The task SHOULD be implemented in Node.js (TypeScript) to match the preferred ADO task execution handler and enable cross-platform operation
- macOS agents MAY work but are not a tested or supported platform (ADO hosted agents are Windows and Linux)
- Addresses: #15194 (27 ­čĹŹ, open since 2018), #8408

### P0 ÔÇô DACPAC deployment via SqlPackage

- The task MUST support deploying a .dacpac file to a target database using SqlPackage
- Supported SqlPackage actions for P0: Publish, Script, DeployReport
- The `action` input specifies which SqlPackage action to invoke
- The `path` input specifies the path to the .dacpac file
- The `additionalArguments` input is appended verbatim to the SqlPackage command line, enabling all SqlPackage properties and parameters (e.g., /p:BlockOnPossibleDataLoss=false, /p:CommandTimeout=3600)
- The `publishProfile` input specifies an optional path to a publish profile .xml file, passed as /Profile: to SqlPackage
- Values in additionalArguments override values in the publish profile
- Addresses parity with both SqlAzureDacpacDeploymentV1 and azure/sql-action

### P0 ÔÇô SQL script execution via sqlcmd

- The task MUST support executing .sql files against the target database
- When action is `sqlScript`, the `path` input specifies the path to a .sql file
- The task MUST assume sqlcmd (go-sqlcmd) is available on PATH
- If sqlcmd is not found on PATH, the task MUST install go-sqlcmd at runtime (same pattern as azure/sql-action)
- An optional `sqlcmdPath` input allows specifying an explicit path to the sqlcmd executable, overriding PATH discovery and auto-install
- The `additionalArguments` input is passed through to sqlcmd for script execution
- Character encoding MUST be preserved (UTF-8 by default) to avoid corruption of non-ASCII characters. Addresses: #223
- Inline SQL (multi-line SQL text in YAML) is NOT supported; users must use .sql files

### P0 ÔÇô SqlPackage discovery

Discovery order:
1. If `sqlpackagePath` input is specified, use it directly (no discovery)
2. dotnet tool global install: check `$HOME/.dotnet/tools/sqlpackage` (Linux/macOS) or `%USERPROFILE%\.dotnet\tools\sqlpackage.exe` (Windows)
3. Windows only: DacFramework MSI install path (`C:\Program Files\Microsoft SQL Server\{version}\DAC\bin\SqlPackage.exe`)
4. PATH fallback

- The task MUST NOT search Windows registry or Visual Studio directories
- If SqlPackage is not found, the task MUST fail with a clear error message recommending `dotnet tool install -g microsoft.sqlpackage`
- Addresses: #18913, #15998

### P0 ÔÇô Authentication via connection string

- The `connectionString` input is the primary authentication mechanism
- All authentication information (server, database, credentials) is encoded in the connection string
- Supported authentication methods via connection string:

| Method | Connection String Pattern |
|--------|---------------------------|
| SQL Authentication | `User ID=<user>;Password=<pass>;` |
| Microsoft Entra Default (Managed Identity / Workload Identity) | `Authentication=Active Directory Default;` |
| Microsoft Entra Service Principal | `Authentication=Active Directory Service Principal;User ID=<clientId>;Password=<secret>;` |
| Microsoft Entra Password | `Authentication=Active Directory Password;User ID=<user>;Password=<pass>;` |
| Microsoft Entra Integrated | `Authentication=Active Directory Integrated;` |

- The `connectionString` input MUST be marked as a secret in the task definition (passwords, tokens)
- The task MUST mask sensitive values (passwords, tokens, full connection strings) in log output
- Addresses: #12083 (SPN auth), #12607 (AccessToken)

### P0 ÔÇô Firewall rule management with explicit disable

The `firewallRuleManagement` input controls firewall behavior:

| Value | Behavior |
|-------|----------|
| `true` | Test connectivity to the target server; if blocked by firewall, add a temporary firewall rule via ARM API, proceed with deployment, then remove the rule |
| `false` | Skip all firewall checks and rule management entirely |

- Default behavior: When `azureSubscription` is provided, `firewallRuleManagement` defaults to `true`. When `azureSubscription` is NOT provided, `firewallRuleManagement` defaults to `false`. Users can explicitly override in either direction.
- When `firewallRuleManagement` is `false`, the task MUST NOT attempt any connectivity pre-check, ARM API calls, or firewall rule operations. This is critical for private VNet deployments.
- When `firewallRuleManagement` is `true`, the task first performs a connectivity test (e.g., TCP probe to the target server). If connectivity succeeds, no firewall rule is created and the task proceeds directly to deployment. A firewall rule is only created if the connectivity test fails with a firewall-related error. The connectivity test itself is considered part of the firewall rule management feature.
- Firewall rule management requires the `azureSubscription` service connection input to be set. If `firewallRuleManagement` is explicitly set to `true` and `azureSubscription` is not provided, the task MUST fail with a clear error indicating the service connection is required for firewall management.
- The service principal or managed identity behind the service connection needs `Microsoft.Sql/servers/firewallRules/write` and `Microsoft.Sql/servers/firewallRules/delete` permissions (not full Contributor). Addresses: #201
- Temporary firewall rules MUST always be removed in a finally block after deployment completes (whether successful or failed). There is no option to persist the rule.
- Proactively addresses issues seen in GitHub sql-action: #88, #186, #205

### P0 ÔÇô Clear, actionable error messages

All error messages MUST include a recommended action or link to documentation. Specific improvements over existing tasks:

- **SqlPackage not found** Ôćĺ "SqlPackage not found. Install via `dotnet tool install -g microsoft.sqlpackage` or specify the path with the sqlpackagePath input."
- **sqlcmd not found** Ôćĺ "sqlcmd not found on PATH. The task will attempt to install go-sqlcmd. To use a specific sqlcmd, set the sqlcmdPath input."
- **Firewall blocked with firewallRuleManagement: false** Ôćĺ "Connection failed. If deploying to Azure SQL, ensure your agent has network access or set firewallRuleManagement to true."
- **Auth failure** Ôćĺ Surface the actual SQL error, not a wrapper error about firewall rules
- Addresses: #120, #209, #252

### P1 ÔÇô SQL project build and deploy (.sqlproj)

When `path` points to a .sqlproj file, the task MUST:
1. Run `dotnet build` on the project to produce a .dacpac
2. Locate the built .dacpac in the build output directory
3. Invoke SqlPackage with the specified action against the target database

- Only SDK-style projects using Microsoft.Build.Sql are supported. Legacy .sqlproj format is not supported.
- The `buildArguments` input passes additional arguments to dotnet build (e.g., `-c Release`, `/p:TreatTSqlWarningsAsErrors=true`)
- The task MUST NOT support build-only mode (build without deploy). Users should use dotnet build directly for that scenario.
- The task MUST verify that the .NET SDK is available before attempting to build. If not found, fail with a clear error recommending installation of .NET SDK via UseDotNet task.
- Addresses parity with azure/sql-action .sqlproj support

### P1 ÔÇô Azure service connection for service principal auth and firewall

The `azureSubscription` input is OPTIONAL. When provided, the service connection enables:

- **Service principal token acquisition:** The task retrieves an access token from the service connection's identity and passes it to SqlPackage as `/AccessToken:` or to sqlcmd as an auth mechanism
- **Firewall rule management:** The service connection provides the ARM API credentials needed to add/remove firewall rules

When `azureSubscription` is provided AND `connectionString` uses `Authentication=Active Directory Default`, the task SHOULD use the service connection's identity for database authentication (token-based).

When `azureSubscription` is NOT provided:
- Firewall rule management is unavailable (if `firewallRuleManagement` is not `false`, fail with a clear message)
- Authentication relies entirely on the `connectionString` input

This enables simple connection-string-only workflows without requiring any Azure service connection, matching azure/sql-action simplicity.

### P1 ÔÇô Publish profile as dedicated input

- The `publishProfile` input specifies the path to a publish profile .xml file
- Passed to SqlPackage as `/Profile:<path>`
- Exists as a dedicated input (not buried in additionalArguments) for discoverability
- Values in additionalArguments override values in the publish profile (default SqlPackage behavior)
- Addresses existing V1 behavior and common user pattern

### P1 ÔÇô Output variable for generated files

- The task MUST set the `SqlDeploymentOutputFile` output variable to the path of generated files for Script and DeployReport actions (and DriftReport, Extract, Export if P2 actions are included)
- Generated files SHOULD be uploaded to the pipeline logs via `##vso[task.uploadfile]` for easy access
- If the user specifies `/OutputPath:` in additionalArguments, the task uses that path. Otherwise, the task generates output to a `GeneratedOutputFiles/` directory in the agent temp folder.
- Addresses parity with SqlAzureDacpacDeploymentV1 output behavior

### P2 ÔÇô Extract, Export, Import, DriftReport actions (pending telemetry review)

- The task MAY support the additional SqlPackage actions: Extract, Export, Import, DriftReport
- These actions are carried forward from SqlAzureDacpacDeploymentV1 for backward compatibility
- **Gating condition:** Inclusion is pending review of ADO telemetry data for SqlAzureDacpacDeploymentV1 to validate usage. If usage of these actions is negligible (<1% of task executions), they will be omitted from the initial release and reconsidered later.

If included:
- **Extract:** Extracts from the target database to a .dacpac file
- **Export:** Exports the target database to a .bacpac file
- **Import:** Imports a .bacpac file to the target database (requires bacpacPath input)

## 1.5 Input Variables Summary

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | pickList | Yes | ÔÇö | publish, script, deployReport, sqlScript. P2: extract, export, import, driftReport |
| `path` | filePath | Yes | ÔÇö | Path to .dacpac, .sqlproj, or .sql file |
| `connectionString` | string (secret) | Yes | ÔÇö | Full connection string including server, database, and auth |
| `azureSubscription` | serviceConnection | No | ÔÇö | Azure RM service connection (required for firewall management and SPN token auth) |
| `publishProfile` | filePath | No | ÔÇö | Path to publish profile XML file |
| `additionalArguments` | string | No | ÔÇö | Additional arguments for SqlPackage or sqlcmd |
| `buildArguments` | string | No | ÔÇö | Additional dotnet build arguments (for .sqlproj only) |
| `sqlpackagePath` | filePath | No | ÔÇö | Override SqlPackage executable path |
| `sqlcmdPath` | filePath | No | ÔÇö | Override sqlcmd executable path |
| `firewallRuleManagement` | boolean | No | true when azureSubscription is set, false otherwise | Enable or disable the connectivity pre-check and automatic firewall rule management. |

## 1.6 Output Variables

| Variable | Description |
|----------|-------------|
| `SqlDeploymentOutputFile` | Path to generated output file for script, deployReport, driftReport, extract, export actions |

## 1.7 Deprecation Plan

| Task deprecated by this spec | Repository | Status | Migration guidance |
|------------------------------|------------|--------|-------------------|
| SqlAzureDacpacDeploymentV1 | azure-pipelines-tasks | Deprecated ÔÇö continue to service security fixes only | Migrate to MicrosoftSqlDeployment@1. Input mapping documented below. |
| SqlDacpacDeploymentOnMachineGroupV0 | azure-pipelines-tasks | Deprecated ÔÇö no new fixes | Use MicrosoftSqlDeployment@1 with self-hosted agent on target machine |
| SqlServerDacpacDeployment | azure-pipelines-tasks | Deprecated ÔÇö no new fixes | Use MicrosoftSqlDeployment@1 with self-hosted agent |
| SqlDacpacDeploy (WinRM) | azure-pipelines-extensions | Deprecated ÔÇö unmaintained | Use deployment groups with MicrosoftSqlDeployment@1 |

### Functionality deliberately not carried forward

| V1 Capability | Reason for removal |
|---------------|-------------------|
| Inline SQL (InlineSqlTask) | Not in sql-action. Users can write SQL to a file in the repo. Eliminates temp-file security pattern. |
| Azure Classic service connections | Azure Classic is end-of-life. Only ARM connections are supported. |
| Invoke-Sqlcmd PowerShell execution | Windows-only dependency. Replaced by cross-platform sqlcmd / go-sqlcmd. |
| Windows registry SqlPackage discovery | Not cross-platform. Replaced by dotnet tool Ôćĺ MSI fallback Ôćĺ PATH. |
| vswhere.exe / VS directory scanning | Not cross-platform, brittle. Replaced by sqlpackagePath input for custom installs. |

### Input mapping: V1 Ôćĺ new task

| V1 Input | New Task Input | Notes |
|----------|----------------|-------|
| `deployType: DacpacTask` | `action: publish` (+ `path: *.dacpac`) | Action is now explicit, not a deploy type wrapper |
| `deployType: SqlTask` | `action: sqlScript` (+ `path: *.sql`) | |
| `deployType: InlineSqlTask` | ÔÇö | Not supported. Write SQL to a file. |
| `DeploymentAction` | `action` | Same concept, lowercase values |
| `DacpacFile` | `path` | Unified path input |
| `BacpacFile` | `path` (for import action) | P2 |
| `SqlFile` | `path` | Unified path input |
| `ServerName` + `DatabaseName` + `SqlUsername` + `SqlPassword` | `connectionString` | Consolidated into connection string |
| `AuthenticationType` | (via connectionString) | Auth type inferred from connection string keywords |
| `PublishProfile` | `publishProfile` | Same concept |
| `AdditionalArguments` | `additionalArguments` | Same concept |
| `SqlAdditionalArguments` / `InlineAdditionalArguments` | `additionalArguments` | Unified; applies to sqlcmd when action: sqlScript |
| `IpDetectionMethod` / `StartIpAddress` / `EndIpAddress` / `DeleteFirewallRule` | `firewallRuleManagement` | Replaced by a single boolean. AutoDetect Ôćĺ true, IPAddressRange Ôćĺ not supported (use pre-configured rules). Firewall rules are always deleted; no opt-out. |
| `azureSubscription` | `azureSubscription` | Now optional |

## 1.8 Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| SqlPackage (microsoft.sqlpackage dotnet tool) | Runtime tool | Required for DACPAC/SQLPROJ actions. Task discovers or user provides path. |
| sqlcmd / go-sqlcmd | Runtime tool | Required for SQL script execution. Auto-installed if not on PATH. |
| .NET SDK | Runtime (conditional) | Required only when building .sqlproj files. Task should recommend UseDotNet@2 step. |
| Azure DevOps service connection (ARM) | Pipeline config (optional) | Required for firewall rule management and SPN-based token auth. |
| Azure Resource Manager API | External service | Used for firewall rule CRUD. Requires Microsoft.Sql/servers/firewallRules/* permissions. |
| azure-pipelines-tasks repo | Hosting | Task shipped as part of the ADO built-in task catalog. |
| Microsoft.Build.Sql SDK | NuGet package (conditional) | Required in user's .sqlproj for SQL project build support. |

## 1.9 Telemetry / Experimentation

### Events to log

| Event | Data | Purpose |
|-------|------|---------|
| Task execution start | Action type, input file type (.dacpac/.sqlproj/.sql), OS, agent type (hosted/self-hosted) | Usage patterns, platform adoption |
| SqlPackage discovery | Method that found SqlPackage (dotnet tool / MSI / PATH / user-specified), version found | Track discovery reliability, version distribution |
| sqlcmd discovery | Found on PATH / auto-installed / user-specified | Track adoption of go-sqlcmd vs pre-installed |
| Firewall rule management | Enabled (true/false), rule created (yes/no), success/failure | Track private VNet adoption, firewall reliability |
| Authentication method | Detected method (SQL / SPN / Entra Default / Entra Password) ÔÇö hashed, not raw credentials | Auth method distribution |
| Task outcome | Success/failure, duration, error category | Reliability monitoring |
| Build step (sqlproj) | Duration, success/failure, build SDK version | SQL project adoption |

### Privacy

- Server names and database names MUST be SHA256-hashed before telemetry emission (matching existing V1 behavior)
- Connection strings, credentials, and tokens MUST NOT appear in telemetry
- File paths MUST NOT be included in telemetry

### Success criteria

- **Adoption:** >25% of SqlAzureDacpacDeploymentV1 users migrate within 6 months of GA
- **Cross-platform:** >10% of task executions on Linux agents within 3 months
- **Reliability:** Task success rate Ôëą V1 success rate within 1 month of GA
- **Error clarity:** Reduction in support tickets related to "SqlPackage not found" and firewall errors

## 1.10 Open Questions / Decisions Needed

| # | Question | Context | Status |
|---|----------|---------|--------|
| 1 | Task implementation language | Node.js (TypeScript) is recommended for cross-platform ADO tasks. PowerShell is an option but limits Linux/macOS. Confirm Node.js. | Proposed: Node.js |
| 2 | Contribution model | Should this task be open-source in azure-pipelines-tasks (like V1) or a separate repo? | Open |
| 3 | go-sqlcmd version pinning | When auto-installing go-sqlcmd, should the task pin a specific version or use latest? Pinning avoids breaking changes but requires task updates for new sqlcmd features. | Proposed: pin to a known-good version, update with task releases |
| 4 | SqlDeploymentOutputFile behavior for user-specified /OutputPath: | When the user specifies /OutputPath: in additionalArguments, should the task still set the output variable and upload the file? V1 has a feature flag for this. | Proposed: always set the output variable to the user-specified path, always upload |
| 5 | Multiple SQL files | Should path support glob patterns for .sql files (e.g., ./scripts/*.sql)? sql-action documents this but errors on multi-file matches (#206). | Proposed: single file only for V1, consider glob in V2 |
| 6 | Named instance support | sql-action v2 broke named instances (SERVER\Instance) in connection strings (#165). The new task's connection string parsing must handle backslashes correctly. | Must validate |
| 7 | Sovereign cloud support | The ARM API endpoints for firewall management differ across Azure Government, Azure China, etc. How should the task determine the correct endpoint? | Proposed: derive from service connection environment |
| 8 | ADO telemetry for Extract/Export/Import | P2 actions are gated on usage telemetry. Who will pull the telemetry data and what threshold determines inclusion? | Pending |
| 9 | Task name finalization | MicrosoftSqlDeployment@1 is a working name. Confirm with ADO task naming conventions. | Open |
| 10 | Workload Identity Federation | ADO supports workload identity federation for service connections. Does the token acquisition flow work correctly with federated credentials? sql-action had issues with OIDC (#264). | Must validate |

## 1.11 Accessibility & Globalization

- Task inputs use standard ADO task UI; no custom UI surfaces
- Task display name and help text should be localized via the standard ADO task localization framework (Strings/resources.resjson)
- Error messages should be in English with links to localized documentation where available

## 1.12 Performance & Security

### Secrets handling
- `connectionString` MUST be a secret input
- The task MUST NOT log connection strings, passwords, or access tokens in plain text
- All sensitive values must be masked in log output

### Temp file cleanup
- Any temporary files (e.g., generated scripts, intermediate build output) MUST be cleaned up in finally blocks

### Firewall rule lifetime
- Temporary firewall rules MUST be scoped to the narrowest possible IP range (single IP when auto-detected) and removed promptly

### Command injection
- The task MUST NOT use shell interpolation or Invoke-Expression to construct commands
- All arguments must be passed as arrays to child processes
- Addresses the V1 legacy Invoke-Expression code path

### SqlPackage timeout
- Document that `/p:CommandTimeout` controls individual statement timeouts and recommend appropriate values for long-running deployments
- Addresses: #144

## 1.13 Rollout Plan

1. **Private preview:** Internal Microsoft pipelines + selected customer buddy program participants
2. **Public preview:** Available in ADO task catalog with "Preview" badge. V1 task remains available and unchanged. Migration documentation published.
3. **GA:** V1 task deprecated with in-task warning banner pointing to migration guide. New task promoted as the recommended SQL deployment task.
4. **V1 servicing:** Security-only fixes for V1 for 12 months after GA. No new features.

## 1.14 Customer feedback that informed this spec

| Source | Theme | How addressed |
|--------|-------|---------------|
| azure-pipelines-tasks #15194 (27 ­čĹŹ) | No Linux support | P0: Cross-platform support |
| azure-pipelines-tasks #18913 (20 comments) | SqlPackage discovery broken for dotnet tool | P0: Modern discovery with dotnet tool priority |
| azure-pipelines-tasks #15998 (20 comments) | SqlPackage discovery broken for VS2022 | P0: Eliminated registry/VS scanning entirely |
| azure-pipelines-tasks #12083 (25 ­čĹŹ) | SPN auth not supported | P0: Connection-string + service connection SPN auth |
| azure/sql-action #186, #205 | Firewall auto-provisioning can't be disabled | P0: firewallRuleManagement: false |
| azure/sql-action #165 | On-prem SQL Server broken in v2 | Open question 6 Ôćĺ Done: named instance validation |
| azure-pipelines-tasks #144 (80 comments) | Deployment timeouts | Security section: document /p:CommandTimeout |
| azure/sql-action #209, #120 | Error messages unhelpful | P0: Actionable error messages |
| azure/sql-action #223 | Character encoding corruption | P0: UTF-8 preservation in script execution |

## 1.15 Appendix

### Customer facing documentation and samples
- https://github.com/Azure-Samples/app-sql-devops-demo-project/blob/main/devops/pipelines/deploy-all.yml
- https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/sql-azure-dacpac-deployment-v1?view=azure-pipelines (GitHub focused)
- https://github.com/Azure-Samples/sql-projects-devops-samples

### Internal engineering resources
- https://mseng.visualstudio.com/AzureDevOps/_wiki/wikis/AzureDevOps.wiki/42472/Standard-procedures?anchor=deployment-schedule

### Points of contact
- Razvan Manole razvanmanole@microsoft.com
- Eric van Wijk ericvan@microsoft.com
- (public docs, but helpful for engineering overview) https://learn.microsoft.com/en-us/azure/devops/extend/develop/add-build-task?toc=%2Fazure%2Fdevops%2Fmarketplace-extensibility%2Ftoc.json&view=azure-devops

### Target database support matrix

| Target | DACPAC Deploy | SQL Script | Firewall Auto-Provisioning | Notes |
|--------|---------------|------------|---------------------------|-------|
| Azure SQL Database | Yes | Yes | Yes (via ARM API) | Full support |
| Azure SQL Managed Instance | Yes | Yes | No | Requires public endpoint (port 3342) or VNet access |
| SQL Server (on-prem/VM) | Yes | Yes | No | Requires self-hosted agent with network access |
| SQL database in Microsoft Fabric | Yes | Yes | No | Requires Entra auth |

### V1 task relationship diagram

```
ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ
Ôöé     MicrosoftSqlDeployment@1        Ôöé  ÔćÉ NEW (this spec)
Ôöé  (Windows, Linux)                   Ôöé
ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöČÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöś
                 Ôöé replaces
    ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔö╝ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ
    Ôöé            Ôöé                            Ôöé
    Ôľ╝            Ôľ╝                            Ôľ╝
ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ
ÔöéSqlDacpacÔöé  ÔöéSqlServer    Ôöé  ÔöéSqlAzureDacpacDeploymentV1    Ôöé
ÔöéDeploy   Ôöé  ÔöéDacpac       Ôöé  Ôöé(primary, Windows-only)       Ôöé
Ôöé(WinRM)  Ôöé  ÔöéDeployment   Ôöé  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöś
ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöś  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöś
   deprecated   deprecated          deprecated
```

---

---

# Appendix A: Source Code Reference (Azure/sql-action)

This appendix contains the complete source code from Azure/sql-action for reference during implementation. These files can be copied and adapted for the new ADO task.

## A.1 src/main.ts (Entry Point)

```typescript
import * as core from "@actions/core";
import * as crypto from "crypto";
import * as path from 'path';
import { AuthorizerFactory } from "azure-actions-webclient/AuthorizerFactory";

import AzureSqlAction, { IActionInputs, IDacpacActionInputs, IBuildAndPublishInputs, ActionType, SqlPackageAction } from "./AzureSqlAction";
import AzureSqlResourceManager from './AzureSqlResourceManager';
import FirewallManager from "./FirewallManager";
import AzureSqlActionHelper from "./AzureSqlActionHelper";
import SqlConnectionConfig from "./SqlConnectionConfig";
import SqlUtils from "./SqlUtils";
import Constants from "./Constants";
import Setup from "./Setup";

const userAgentPrefix = !!process.env.AZURE_HTTP_USER_AGENT ? `${process.env.AZURE_HTTP_USER_AGENT}` : "";

export default async function run() {
    await Setup.setupSqlcmd();

    let firewallManager;
    try {
        setUserAgentVariable();
        
        const inputs = getInputs();
        const azureSqlAction = new AzureSqlAction(inputs);
        
        // Unless skip-firewall-check is set to true, check if the runner's IP address is allowed to connect to the server
        if (inputs.skipFirewallCheck !== true) {
            const runnerIPAddress = await SqlUtils.detectIPAddress(inputs.connectionConfig);
            if (runnerIPAddress) {
                core.debug(`Temporarily adding '${runnerIPAddress}' to the firewall of ${inputs.connectionConfig.Server}.`);
                let azureResourceAuthorizer = await AuthorizerFactory.getAuthorizer();
                let azureSqlResourceManager = await AzureSqlResourceManager.getResourceManager(inputs.connectionConfig.Server, azureResourceAuthorizer);
                firewallManager = new FirewallManager(azureSqlResourceManager);
                await firewallManager.addFirewallRule(runnerIPAddress);
            }
        }

        await azureSqlAction.execute();
    }
    catch (error) {
        core.setFailed(error.message);
    }
    finally {
        if (firewallManager) {
            await firewallManager.removeFirewallRule();
        }

        // Reset AZURE_HTTP_USER_AGENT
        core.exportVariable('AZURE_HTTP_USER_AGENT', userAgentPrefix);
    }
}

function setUserAgentVariable(): void {
    const usrAgentRepo = crypto.createHash('sha256').update(`${process.env.GITHUB_REPOSITORY}`).digest('hex');
    const actionName = 'AzureSqlAction';
    const userAgentString = (!!userAgentPrefix ? `${userAgentPrefix}+` : '') + `GITHUBACTIONS_${actionName}_${usrAgentRepo}`;
    core.exportVariable('AZURE_HTTP_USER_AGENT', userAgentString);
}

function getInputs(): IActionInputs {
    core.debug('Get action inputs.');

    const connectionString = core.getInput('connection-string', { required: true });
    const connectionConfig = new SqlConnectionConfig(connectionString);

    let filePath = core.getInput('path', { required: true });
    filePath = AzureSqlActionHelper.resolveFilePath(filePath);

    // Optional inputs
    const action = core.getInput('action');

    switch (path.extname(filePath).toLowerCase()) {
        case Constants.sqlFileExtension:
            return {
                actionType: ActionType.SqlAction,
                connectionConfig: connectionConfig,
                filePath: filePath,
                additionalArguments: core.getInput('arguments') || undefined,
                skipFirewallCheck: core.getBooleanInput('skip-firewall-check')
            };

        case Constants.dacpacExtension:
            if (!action) {
                throw new Error('The action input must be specified when using a .dacpac file.');
            }

            return {
                actionType: ActionType.DacpacAction,
                connectionConfig: connectionConfig,
                filePath: filePath,
                sqlpackageAction: AzureSqlActionHelper.getSqlpackageActionTypeFromString(action),
                sqlpackagePath: core.getInput('sqlpackage-path') || undefined,
                additionalArguments: core.getInput('arguments') || undefined,
                skipFirewallCheck: core.getBooleanInput('skip-firewall-check')
            } as IDacpacActionInputs;

        case Constants.sqlprojExtension:
            if (!action) {
                throw new Error('The action input must be specified when using a .sqlproj file.');
            }

            return {
                actionType: ActionType.BuildAndPublish,
                connectionConfig: connectionConfig,
                filePath: filePath,
                buildArguments: core.getInput('build-arguments') || undefined,
                sqlpackageAction: AzureSqlActionHelper.getSqlpackageActionTypeFromString(action),
                sqlpackagePath: core.getInput('sqlpackage-path') || undefined,
                additionalArguments: core.getInput('arguments') || undefined,
                skipFirewallCheck: core.getBooleanInput('skip-firewall-check')
            } as IBuildAndPublishInputs;

        default:
            throw new Error(`Invalid file type provided as input ${filePath}. File must be a .sql, .dacpac, or .sqlproj file.`)
    }
}

run();
```

## A.2 src/Constants.ts

```typescript
export default class Constants {
    static readonly ipv4MatchPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
    static readonly connectionStringTester = /^[;\s]*([\w\s]+=(?:('[^']*(''[^']*)*')|("[^"]*(""[^"]*)*")|((?!['"])[^;]*)))(;[;\s]*([\w\s]+=(?:('[^']*(''[^']*)*')|("[^"]*(""[^"]*)*")|((?!['"])[^;]*))))*[;\s]*$/;
    static readonly connectionStringParserRegex = /(?<key>[\w\s]+)=(?<val>('[^']*(''[^']*)*')|("[^"]*(""[^"]*)*")|((?!['"])[^;]*))/g;

    static readonly dacpacExtension = ".dacpac";
    static readonly sqlFileExtension = ".sql";
    static readonly sqlprojExtension = ".sqlproj";

    static readonly sqlcmdPasswordEnvVarName = "SQLCMDPASSWORD";
}
```

## A.3 src/AzureSqlAction.ts (Main Action Logic)

```typescript
import * as path from 'path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

import AzureSqlActionHelper from './AzureSqlActionHelper';
import DotnetUtils from './DotnetUtils';
import Constants from './Constants';
import SqlConnectionConfig from './SqlConnectionConfig';
import SqlUtils from './SqlUtils';

export enum ActionType {
    DacpacAction,
    SqlAction,
    BuildAndPublish
}

export interface IActionInputs {
    actionType: ActionType;
    connectionConfig: SqlConnectionConfig;
    filePath: string;
    additionalArguments?: string;
    skipFirewallCheck: boolean;
}

export interface IDacpacActionInputs extends IActionInputs {
    sqlpackageAction: SqlPackageAction;
    sqlpackagePath?: string;
}

export interface IBuildAndPublishInputs extends IDacpacActionInputs {
    buildArguments?: string;
}

export enum SqlPackageAction {
    Publish,
    Extract,
    Export,
    Import,
    DriftReport,
    DeployReport,
    Script
}

export default class AzureSqlAction {
    constructor(inputs: IActionInputs) {
        this._inputs = inputs;
    }

    public async execute() {
        if (this._inputs.actionType === ActionType.DacpacAction) {
            await this._executeDacpacAction(this._inputs as IDacpacActionInputs);
        }
        else if (this._inputs.actionType === ActionType.SqlAction) {
            await this._executeSqlFile(this._inputs);
        }
        else if (this._inputs.actionType === ActionType.BuildAndPublish) {
            const buildAndPublishInputs = this._inputs as IBuildAndPublishInputs;
            const dacpacPath = await this._executeBuildProject(buildAndPublishInputs);

            // Reuse DacpacAction for publish
            const publishInputs = {
                actionType: ActionType.DacpacAction,
                connectionConfig: buildAndPublishInputs.connectionConfig,
                filePath: dacpacPath,
                additionalArguments: buildAndPublishInputs.additionalArguments,
                sqlpackageAction: buildAndPublishInputs.sqlpackageAction,
                sqlpackagePath: buildAndPublishInputs.sqlpackagePath
            } as IDacpacActionInputs;
            await this._executeDacpacAction(publishInputs);
        }
        else {
            throw new Error(`Invalid AzureSqlAction '${this._inputs.actionType}'.`)
        }
    }

    private async _executeDacpacAction(inputs: IDacpacActionInputs) {
        core.debug('Begin executing sqlpackage');
        let sqlPackagePath = await AzureSqlActionHelper.getSqlPackagePath(inputs);
        let sqlPackageArgs = this._getSqlPackageArguments(inputs);

        await exec.exec(`"${sqlPackagePath}" ${sqlPackageArgs}`);

        console.log(`Successfully executed action ${SqlPackageAction[inputs.sqlpackageAction]} on target database.`);
    }

    private async _executeSqlFile(inputs: IActionInputs) {
        core.debug('Begin executing sql script');

        let sqlcmdCall = SqlUtils.buildSqlCmdCallWithConnectionInfo(inputs.connectionConfig);
        sqlcmdCall += ` -i "${inputs.filePath}"`;
        if (!!inputs.additionalArguments) {
            sqlcmdCall += ` ${inputs.additionalArguments}`;
        }

        await exec.exec(sqlcmdCall);
        
        console.log(`Successfully executed SQL file on target database.`);
    }

    private async _executeBuildProject(inputs: IBuildAndPublishInputs): Promise<string> {
        core.debug('Begin building project');
        const projectName = path.basename(inputs.filePath, Constants.sqlprojExtension);
        const additionalBuildArguments = inputs.buildArguments ?? '';
        const parsedArgs = await DotnetUtils.parseCommandArguments(additionalBuildArguments);
        let outputDir = '';

        // Set output dir if it is set in the build arguments
        const outputArgument = await DotnetUtils.findArgument(parsedArgs, "--output", "-o");
        if (outputArgument) {
            outputDir = outputArgument;
        } else {
            // Set output dir to ./bin/<configuration> if configuration is set via arguments
            // Default to Debug if configuration is not set
            const configuration = await DotnetUtils.findArgument(parsedArgs, "--configuration", "-c") ?? "Debug";
            outputDir = path.join(path.dirname(inputs.filePath), "bin", configuration);
        }

        await exec.exec(`dotnet build "${inputs.filePath}" -p:NetCoreBuild=true ${additionalBuildArguments}`);

        const dacpacPath = path.join(outputDir, projectName + Constants.dacpacExtension);
        console.log(`Successfully built database project to ${dacpacPath}`);
        return dacpacPath;
    }

    private _getSqlPackageArguments(inputs: IDacpacActionInputs) {
        let args = '';

        switch (inputs.sqlpackageAction) {
            case SqlPackageAction.Publish: 
            case SqlPackageAction.Script:
            case SqlPackageAction.DeployReport:
                args += `/Action:${SqlPackageAction[inputs.sqlpackageAction]} /TargetConnectionString:"${inputs.connectionConfig.EscapedConnectionString}" /SourceFile:"${inputs.filePath}"`;
                break;
            case SqlPackageAction.DriftReport:
                args += `/Action:${SqlPackageAction[inputs.sqlpackageAction]} /TargetConnectionString:"${inputs.connectionConfig.EscapedConnectionString}"`;
                break;

            default:
                throw new Error(`Not supported SqlPackage action: '${SqlPackageAction[inputs.sqlpackageAction]}'`);
        }

        if (!!inputs.additionalArguments) {
            args += ' ' + inputs.additionalArguments;
        }

        return args;
    }   

    private _inputs: IActionInputs;
}
```

## A.4 src/SqlConnectionConfig.ts (Connection String Parser)

```typescript
import * as core from '@actions/core';
import { parseSqlConnectionString } from '@tediousjs/connection-string';
import Constants from './Constants';

export default class SqlConnectionConfig {
    private _parsedConnectionString: Record<string, string | number | boolean>;
    private _rawConnectionString: string;

    constructor(connectionString: string) {
        this._validateConnectionString(connectionString);

        this._rawConnectionString = connectionString;
        this._parsedConnectionString = parseSqlConnectionString(connectionString, true, true);

        this._maskSecrets();
        this._validateconfig();
    }

    public get Server(): string {
        let server = this._parsedConnectionString['data source'] as string;
        // Remove port number
        if (server?.includes(',')) {
            server = server.split(',')[0].trim();
        }
        // Remove tcp protocol
        if (server?.startsWith('tcp:')) {
            server = server.slice(4).trim();
        }
        return server;
    }

    public get Port(): number | undefined {
        const server = this._parsedConnectionString['data source'] as string;
        if (server && server.includes(',')) {
            return parseInt(server.split(',')[1].trim());
        }
        return undefined;
    }

    public get Database(): string {
        return this._parsedConnectionString['initial catalog'] as string;
    }

    public get UserId(): string | undefined {
        return this._parsedConnectionString['user id'] as string | undefined;
    }

    public get Password(): string | undefined {
        return this._parsedConnectionString['password'] as string | undefined;
    }

    /**
     * Returns the authentication type used in the connection string, with spaces removed and in lower case.
     */
    public get FormattedAuthentication(): string | undefined {
        const auth = this._parsedConnectionString['authentication'] as string | undefined;
        return auth?.replace(/\s/g, '').toLowerCase();
    }

    /**
     * Returns the connection string escaped by double quotes.
     */
    public get EscapedConnectionString() : string {
        let result = '';

        // Isolate all the key value pairs from the raw connection string
        // Using the raw connection string instead of the parsed one to keep it as close to the original as possible
        const matches = Array.from(this._rawConnectionString.matchAll(Constants.connectionStringParserRegex));
        for (const match of matches) {
            if (match.groups) {
                const key = match.groups.key.trim();
                let val = match.groups.val.trim();

                // If the value is enclosed in double quotes, escape the double quotes
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = '""' + val.slice(1, -1) + '""';
                }

                result += `${key}=${val};`;
            }
        }

        return result;
    }

    /**
     * The basic format of a connection string includes a series of keyword/value pairs separated by semicolons. 
     * The equal sign (=) connects each keyword and its value. (Ex: Key1=Val1;Key2=Val2)
     * 
     * Following rules are to be followed while passing special characters in values:
            1. To include values that contain a semicolon, single-quote character, or double-quote character, the value must be enclosed in double quotation marks. 
            2. If the value contains both a semicolon and a double-quote character, the value can be enclosed in single quotation marks. 
            3. The single quotation mark is also useful if the value starts with a double-quote character. Conversely, the double quotation mark can be used if the value starts with a single quotation mark. 
            4. If the value contains both single-quote and double-quote characters, the quotation mark character used to enclose the value must be doubled every time it occurs within the value.
        
        Regex used by the parser(connectionStringParserRegex) to parse the VALUE:
            
            ('[^']*(''[^']*)*') -> value enclosed with single quotes and has consecutive single quotes 
            |("[^"]*(""[^"]*)*") -> value enclosed with double quotes and has consecutive double quotes
            |((?!['"])[^;]*)) -> value does not start with quotes does not contain any special character. Here we do a positive lookahead to ensure that the value doesn't start with quotes which should have been handled in previous cases
        Regex used to validate the entire connection string:
        
        A connection string is considered valid if it is a series of key/value pairs separated by semicolons. Each key/value pair must satisy the connectionStringParserRegex to ensure it is a valid key/value pair.
        ^[;\s]*{KeyValueRegex}(;[;\s]*{KeyValueRegex})*[;\s]*$
        where KeyValueRegex = ([\w\s]+=(?:('[^']*(''[^']*)*')|("[^"]*(""[^"]*)*")|((?!['"])[^;]*))))
    */
    private _validateConnectionString(connectionString: string) {
        if (!Constants.connectionStringTester.test(connectionString)) {
            throw new Error('Invalid connection string. A valid connection string is a series of keyword/value pairs separated by semi-colons. If there are any special characters like quotes or semi-colons in the keyword value, enclose the value within quotes. Refer to this link for more info on connection string https://aka.ms/sqlconnectionstring');
        }
    }

    /**
     * Mask sensitive parts of the connection settings so they don't show up in the Github logs.
     */
    private _maskSecrets(): void {
        // User ID could be client ID in some authentication types
        if (this.UserId) {
            core.setSecret(this.UserId);
        }

        if (this.Password) {
            core.setSecret(this.Password);
        }
    }

    private _validateconfig(): void {
        if (!this.Server) {
            throw new Error(`Invalid connection string. Please ensure 'Server' or 'Data Source' is provided in the connection string.`);
        }

        if (!this.Database) {
            throw new Error(`Invalid connection string. Please ensure 'Database' or 'Initial Catalog' is provided in the connection string.`);
        }

        switch (this.FormattedAuthentication) {
            case undefined:
            case 'sqlpassword': {
                // SQL password
                if (!this.UserId) {
                    throw new Error(`Invalid connection string. Please ensure 'User' or 'User ID' is provided in the connection string.`);
                }
                if (!this.Password) {
                    throw new Error(`Invalid connection string. Please ensure 'Password' is provided in the connection string.`);
                }
                break;
            }
            case 'activedirectorypassword': {
                if (!this.UserId) {
                    throw new Error(`Invalid connection string. Please ensure 'User' or 'User ID' is provided in the connection string.`);
                }
                if (!this.Password) {
                    throw new Error(`Invalid connection string. Please ensure 'Password' is provided in the connection string.`);
                }
                break;
            }
            case 'activedirectoryserviceprincipal': {
                // User ID is client ID and password is secret
                if (!this.UserId) {
                    throw new Error(`Invalid connection string. Please ensure client ID is provided in the 'User' or 'User ID' field of the connection string.`);
                }
                if (!this.Password) {
                    throw new Error(`Invalid connection string. Please ensure client secret is provided in the 'Password' field of the connection string.`);
                }
                break;
            }
        }
    }
}
```

## A.5 src/SqlUtils.ts (IP Detection)

```typescript
import * as core from "@actions/core";
import * as exec from '@actions/exec';
import Constants from "./Constants";
import SqlConnectionConfig from "./SqlConnectionConfig";

export interface ConnectionResult {
    /** True if connection succeeds, false otherwise */
    success: boolean,

    /** Connection error on failure */
    errorMessage?: string,

    /** Client IP address if connection fails due to firewall rule */
    ipAddress?: string
}

export default class SqlUtils {

    /**
     * Tries connection to server to determine if client IP address is restricted by the firewall.
     * First tries with master connection, and then with user DB if first one fails.
     * @param SqlConnectionConfig The connection configuration to try.
     * @returns The client IP address if firewall restriction is present, or an empty string if connection succeeds. Throws otherwise.
     */
    static async detectIPAddress(connectionConfig: SqlConnectionConfig): Promise<string> {
        // First try connection to master
        let result = await this.tryConnection(connectionConfig, true);
        if (result.success) {
            return '';
        }
        else if (result.ipAddress) {
            return result.ipAddress;
        }

        // Retry connection with user DB
        result = await this.tryConnection(connectionConfig, false);
        if (result.success) {
            return '';
        }
        else if (result.ipAddress) {
            return result.ipAddress;
        }
        else {
            throw new Error(`Failed to add firewall rule. Unable to detect client IP Address. ${result.errorMessage}`);
        }
    }

    /**
     * Tries connection with the specified configuration.
     * @param config Configuration for the connection.
     * @param useMaster If true, uses "master" instead of the database specified in @param config. Every other config remains the same.
     * @returns A ConnectionResult object indicating success/failure, the connection on success, or the error on failure.
     */
    private static async tryConnection(config: SqlConnectionConfig, useMaster?: boolean): Promise<ConnectionResult> {
        const database = useMaster ? "master" : config.Database;
        
        let sqlCmdError = '';
        try {
            core.debug(`Validating if client has access to '${database}' on '${config.Server}'.`);
            let sqlCmdCall = this.buildSqlCmdCallWithConnectionInfo(config, database);
            sqlCmdCall += ` -Q "SELECT 'Validating connection from GitHub SQL Action'"`;
            await exec.exec(sqlCmdCall, [], {
                silent: true,
                listeners: {
                    stderr: (data: Buffer) => sqlCmdError += data.toString(),
                    // Some AAD errors come through as regular stdout. For this scenario, we will just append any stdout 
                    // to the error string since it will only be surfaced if sqlcmd actually fails.
                    stdout: (data: Buffer) => sqlCmdError += data.toString()
                }
            });

            // If we reached here it means connection succeeded
            return {
                success: true
            };
        }
        catch (error) {
            core.debug(`${error.message}`);
            core.debug(`SqlCmd stderr: ${sqlCmdError}`);
            return {
                success: false,
                errorMessage: sqlCmdError,
                ipAddress: this.parseErrorForIpAddress(sqlCmdError)
            };
        }
    }

    /**
     * Parse an error message to see if it contains an IP address.
     * Returns the IP address if found, otherwise undefined.
     */
    private static parseErrorForIpAddress(errorMessage: string): string | undefined {
        let ipAddress: string | undefined;
        const ipAddresses = errorMessage.match(Constants.ipv4MatchPattern);
        if (!!ipAddresses) {
            ipAddress = ipAddresses[0];      
        }
        return ipAddress;
    }

    /**
     * Builds the beginning of a sqlcmd command populated with the connection settings.
     * @param connectionConfig The connection settings to be used for this sqlcmd call.
     * @param database The database to connect to. If not specified, defaults to the database in the connection settings.
     * @returns A partial sqlcmd command with connection and authentication settings.
     */
    public static buildSqlCmdCallWithConnectionInfo(connectionConfig: SqlConnectionConfig, database?: string): string {
        // sqlcmd should be added to PATH already, we just need to see if need to add ".exe" for Windows
        let sqlCmdPath: string;
        switch (process.platform) {
            case "win32": 
                sqlCmdPath = "sqlcmd.exe";
                break;
            case "linux":
            case "darwin":
                sqlCmdPath = "sqlcmd";
                break;
            default:
                throw new Error(`Platform ${process.platform} is not supported.`);
        }

        if (!database) {
            database = connectionConfig.Database;
        }

        let sqlcmdCall = `"${sqlCmdPath}" -S ${connectionConfig.Server},${connectionConfig.Port ?? 1433} -d ${database}`;

        // Determine the correct sqlcmd arguments based on the auth type
        switch (connectionConfig.FormattedAuthentication) {
            case undefined:
            case 'sqlpassword':
                // No authentication type defaults SQL login
                sqlcmdCall += ` -U "${connectionConfig.UserId}"`;
                core.exportVariable(Constants.sqlcmdPasswordEnvVarName, connectionConfig.Password);
                break;

            case 'activedirectorydefault':
                sqlcmdCall += ` --authentication-method=ActiveDirectoryDefault`;
                break;

            case 'activedirectorypassword':
                sqlcmdCall += ` --authentication-method=ActiveDirectoryPassword -U "${connectionConfig.UserId}"`;
                core.exportVariable(Constants.sqlcmdPasswordEnvVarName, connectionConfig.Password);
                break;

            case 'activedirectoryserviceprincipal':
                sqlcmdCall += ` --authentication-method=ActiveDirectoryServicePrincipal -U "${connectionConfig.UserId}"`;
                core.exportVariable(Constants.sqlcmdPasswordEnvVarName, connectionConfig.Password);
                break;

            default:
                throw new Error(`Authentication type ${connectionConfig.FormattedAuthentication} is not supported.`);
        }

        return sqlcmdCall;
    }

}
```

## A.6 src/FirewallManager.ts

```typescript
import * as core from '@actions/core';
import AzureSqlResourceManager, { FirewallRule } from './AzureSqlResourceManager';

export default class FirewallManager {
    constructor(azureSqlResourceManager: AzureSqlResourceManager) {
        this._resourceManager = azureSqlResourceManager;
    }

    public async addFirewallRule(ipAddress: string) {
        if (!ipAddress) {
            core.debug(`Client has access to Sql server. Skip adding firewall exception.`);
            return;
        }
        console.log(`Client does not have access to server. Adding firewall exception for client's IP address.`);
        this._firewallRule = await this._resourceManager.addFirewallRule(ipAddress, ipAddress);
        core.debug(JSON.stringify(this._firewallRule));
        console.log(`Successfully added firewall rule ${this._firewallRule.name}.`);
    }


    

    public async removeFirewallRule() {
        if (this._firewallRule) {
            console.log(`Removing firewall rule '${this._firewallRule.name}'.`);
            await this._resourceManager.removeFirewallRule(this._firewallRule);
            console.log('Successfully removed firewall rule.');
        }
    }

    private _resourceManager: AzureSqlResourceManager;
    private _firewallRule?: FirewallRule;
}
```

## A.7 src/Setup.ts (go-sqlcmd Auto-Install)

```typescript
// This file is run before main.js to setup the tools that the action depends on
// https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#runspre

import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as path from 'path';
import uuidV4 from 'uuid/v4';

export const sqlcmdToolName = 'go-sqlcmd';
export const sqlcmdVersion = '1.6.0';

export default class Setup {
    
    /**
     * Ensures go-sqlcmd is in the runner's tool cache and PATH environment variable.
     */
    public static async setupSqlcmd(): Promise<void> {
        // Get sqlcmd from tool cache; if not found, download it and add to tool cache
        let sqlcmdPath = tc.find(sqlcmdToolName, sqlcmdVersion);
        if (!sqlcmdPath) {
            const extractedPath = await this.downloadAndExtractSqlcmd();
            sqlcmdPath = await tc.cacheDir(extractedPath, sqlcmdToolName, sqlcmdVersion);
        }
        
        // Add sqlcmd to PATH
        core.addPath(sqlcmdPath);
    }

    /**
     * Downloads go-sqlcmd release from GitHub and extracts from the compressed file.
     * @returns The path to the extracted file.
     */
    private static async downloadAndExtractSqlcmd(): Promise<string> {
        let downloadPath: string;
        switch (process.platform) {
            case 'linux':
                downloadPath = await tc.downloadTool(`https://github.com/microsoft/go-sqlcmd/releases/download/v${sqlcmdVersion}/sqlcmd-v${sqlcmdVersion}-linux-x64.tar.bz2`);
                return await tc.extractTar(downloadPath, undefined, 'xj');
    
            case 'win32':
                // forcing a .zip extension on the downloaded item due to inconsistent windows behavior in unzipping files with no extension
                // upstream issue: https://github.com/actions/toolkit/issues/1179
                const dest = path.join(process.env['RUNNER_TEMP'] || '', uuidV4()+'.zip');
                downloadPath = await tc.downloadTool(`https://github.com/microsoft/go-sqlcmd/releases/download/v${sqlcmdVersion}/sqlcmd-v${sqlcmdVersion}-windows-x64.zip`, dest);
                return await tc.extractZip(downloadPath);
    
            default:
                throw new Error(`Runner OS is not supported: ${process.platform}`);
        }
    }
}
```

## A.8 src/DotnetUtils.ts (Build Argument Parsing)

```typescript
export default class DotnetUtils {

    /***
     * Parses the string input as command line arguments, returns an object where 
     * keys are argument name and values are argument values.
     * - Assumes the string is a properly formatted list of arguments, where name/value pairs
     * are separated by spaces and values with spaces are enclosed by single or double quotes.
     * - Dashes are preserved in the param names.
     * - Enclosing quotes are preserved in the param values.
     * - Params without values (ex. --verbose) are assigned undefined.
     * 
     * Example input: -o "output file" -c configuration -v 'm' --force
     * Returns: { "-o":"output file", "-c":"configuration", "-v":"m", "--force":undefined }
     */
    public static async parseCommandArguments(args: string): Promise<object> {
        let dictionary = {};

        // Regex matches dotnet build parameters: https://docs.microsoft.com/dotnet/core/tools/dotnet-build
        // \-\-?[A-Za-z\-]+     Parameter name, may have 1 or 2 dashes. Ex: -o, --verbose
        // (?:$|\s+)            End of line or whitespace separating param name and value
        // (?:[^\s"'\-]+        Param value, anything that's not a whitespace, ", ', or -
        //   |"[^"]*"|'[^']*')    ... or anything enclosed in either " or '
        const matches = args.match(/(\-\-?[A-Za-z\-]+(?:$|\s+)(?:[^\s"'\-]+|"[^"]*"|'[^']*')?)/g);
        matches?.forEach(match => {
            const whitespaceIndex = match.trim().indexOf(' ');
            if (whitespaceIndex >= 0) {
                // match is in the format of -paramName "param value"
                const paramName = match.substring(0, whitespaceIndex);
                const paramValue = match.substring(whitespaceIndex).trim();
                dictionary[paramName] = paramValue;
            } else {
                // match is only the param name with no value. Ex: --force, --verbose
                dictionary[match] = undefined;
            }
        });

        return dictionary;
    }

    /**
     * Looks for an argument in a dictionary of argument name/value pairs.
     * Returns the value if found, else returns undefined.
     * @param args A dictionary where keys are arg names and values are arg values.
     * @param argumentToFind The argument to look for.
     * @param alias The alias of the argument to look for.
     */
    public static async findArgument(args: object, argumentToFind: string, alias?: string): Promise<string | undefined> {
        return args[argumentToFind] ?? (alias ? args[alias] : undefined);
    }
}
```

## A.9 src/AzureSqlActionHelper.ts (SqlPackage Discovery - FULL FILE)

**ÔÜá´ŞĆ NOTE:** This file has broken SqlPackage discovery on Linux (`~/.dotnet/tools/sqlpackage` doesn't work). See Section 5.1.1 for fixes needed.

```typescript
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from "path";
import * as fs from 'fs';
import * as glob from 'glob';
import winreg from 'winreg';
import * as semver from 'semver';
import { SqlPackageAction, IDacpacActionInputs } from './AzureSqlAction';

const IS_WINDOWS = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';
const dotnetLinuxPath = '~/.dotnet/tools/sqlpackage';

interface ISqlPackageInstall {
    sqlPackagePath: string;
    sqlPackageVersion: semver.SemVer;
}

export default class AzureSqlActionHelper {
    
    public static async getSqlPackagePath(inputs: IDacpacActionInputs): Promise<string> {
        if (!!inputs.sqlpackagePath) {
            if (!fs.existsSync(inputs.sqlpackagePath)) {
                throw new Error(`SqlPackage not found at provided path: ${inputs.sqlpackagePath}`);
            }
            core.debug(`Return the cached path of SqlPackage executable: ${inputs.sqlpackagePath}`);
            return inputs.sqlpackagePath;
        }

        if (!!this._sqlPackagePath) {
            core.debug(`Return the cached path of SqlPackage executable: ${this._sqlPackagePath}`);
            return this._sqlPackagePath;
        }

        if (IS_WINDOWS) {
            this._sqlPackagePath = await this._getSqlPackageExecutablePath();
        }
        else if (IS_LINUX) {
            this._sqlPackagePath = this._getSqlPackageBinaryPathLinux();
        }
        else {
            this._sqlPackagePath = this._getSqlPackageBinaryPathMac();
        }

        return this._sqlPackagePath;
    }

    public static getRegistrySubKeys(path: string): Promise<winreg.Registry[]> {
        return new Promise((resolve) => {
            core.debug(`Getting sub-keys at registry path: HKLM:${path}`);
            let regKey = new winreg({
                hive: winreg.HKLM,
                key: path
            });

            regKey.keys((error, result) => {
                return !!error ? '' : resolve(result);
            })
        });
    }

    public static getRegistryValue(registryKey: winreg.Registry, name: string): Promise<string> {
        return new Promise((resolve) => {
            core.debug(`Getting registry value ${name} at path: HKLM:${registryKey.key}`);
            registryKey.get(name, (error, result: winreg.RegistryItem) => {
                resolve(!!error ? '' : result.value);
            });
        });
    }

    public static registryKeyExists(path: string): Promise<boolean> {
        core.debug(`Checking if registry key 'HKLM:${path}' exists.`);
        return new Promise((resolve) => {
            let regKey = new winreg({
                hive: winreg.HKLM,
                key: path
            });

            regKey.keyExists((error, result: boolean) => {
                resolve(!!error ? false : result);
            })
        });
    }

    public static resolveFilePath(filePathPattern: string): string {
        let filePath = filePathPattern;
        if (glob.hasMagic(filePathPattern)) {
            let matchedFiles: string[] = glob.sync(filePathPattern);
            if (matchedFiles.length === 0) {
                throw new Error(`No files found matching pattern ${filePathPattern}`);
            }

            if (matchedFiles.length > 1) {
                throw new Error(`Muliple files found matching pattern ${filePathPattern}`);
            }

            filePath = matchedFiles[0];
        }

        if (!fs.existsSync(filePath)) {
            throw new Error(`Unable to find file at location: ${filePath}`);
        }
        
        return filePath;
    }

    public static getSqlpackageActionTypeFromString(action: string): SqlPackageAction {
        // Default to Publish if not specified
        if (!action) {
            return SqlPackageAction.Publish;
        }

        switch (action.trim().toLowerCase()) {
            case 'publish':
                return SqlPackageAction.Publish;
            // case 'extract':
            //     return SqlPackageAction.Extract;
            // case 'import':
            //     return SqlPackageAction.Import;
            // case 'export':
            //     return SqlPackageAction.Export;
            case 'driftreport':
                return SqlPackageAction.DriftReport;
            case 'deployreport':
                return SqlPackageAction.DeployReport;
            case 'script':
                return SqlPackageAction.Script;
            default:
                throw new Error(`Action ${action} is invalid. Supported action types are: Publish, Script, DriftReport, or DeployReport.`);
        }
    }

    /**
     * SqlPackage.exe can be installed in four ways:
     *  0. as a global dotnet tool
     *  1. SQL Server Management Studio (SSMS) used to install it to in location C:/Program Files/Microsoft SQL Server/{SqlVersion}/DAC/bin/SqlPackage.exe' (REMOVE in the future)
     *  2. the Dac Framework MSI installs it in location C:/Program Files/Microsoft SQL Server/{SqlVersion}/DAC/bin/SqlPackage.exe'
     *  3. SSDT (SQL Server Data Tools) installs it in location VS Install Directory/Common7/IDE/Extensions/Microsoft/SQLDB/DAC/{SqlVersion}
     * 
     *  This method finds the location of SqlPackage.exe from both the location and return the highest version of SqlPackage.exe
     */
    private static async _getSqlPackageExecutablePath(): Promise<string> {
        core.debug('Getting location of SqlPackage');
        let sqlPackageVersions: ISqlPackageInstall[] = [];

        let sqlPackagePathInstalledWithDotnetTool = await this._getSqlPackageExeInstalledDotnetTool();
        if (sqlPackagePathInstalledWithDotnetTool === undefined || sqlPackagePathInstalledWithDotnetTool.sqlPackagePath === '') {
            core.debug('SqlPackage installed with dotnet tool not found on machine.');
        } else {
            sqlPackageVersions.push(sqlPackagePathInstalledWithDotnetTool);
        }

        let sqlPackagePathInstalledWithSSMS = await this._getSqlPackageInstalledWithSSMS();
        if (sqlPackagePathInstalledWithSSMS === undefined || sqlPackagePathInstalledWithSSMS.sqlPackagePath === '') {
            core.debug('SqlPackage installed with SSMS not found on machine.');
        } else {
            sqlPackageVersions.push(sqlPackagePathInstalledWithSSMS);
        }

        let sqlPackagePathInstalledWithDacMsi = await this._getSqlPackageInstalledWithDacMsi();
        if (sqlPackagePathInstalledWithDacMsi === undefined || sqlPackagePathInstalledWithDacMsi.sqlPackagePath === '') {
            core.debug('SqlPackage installed with DacFramework MSI not found on machine.');
        } else {
            sqlPackageVersions.push(sqlPackagePathInstalledWithDacMsi);
        }

        let sqlPackagePathInstalledWithSSDT = await this._getSqlPackageInstalledWithSSDT();
        if (sqlPackagePathInstalledWithSSDT === undefined || sqlPackagePathInstalledWithSSDT.sqlPackagePath === '') {
            core.debug('SqlPackage installed with SSDT not found on machine.');
        } else {
            sqlPackageVersions.push(sqlPackagePathInstalledWithSSDT);
        }

        // sort the versions in ascending order, remove max version from the end
        sqlPackageVersions.sort((sqlPackage1, sqlPackage2) => {
            return semver.compareBuild(sqlPackage2.sqlPackageVersion, sqlPackage1.sqlPackageVersion);
        });
        let maximumVersion = sqlPackageVersions.pop();

        if (maximumVersion === undefined || maximumVersion.sqlPackagePath === '') {
            throw new Error('Unable to find the location of SqlPackage');
        }

        core.debug(`SqlPackage ${maximumVersion.sqlPackageVersion} selected at location: ${maximumVersion.sqlPackagePath}`);
        return maximumVersion.sqlPackagePath;
    }

    /** SqlPackage returns a multi-part version number major.minor.patch
     * sqlpackage doesn't append -preview to the version number, but if added in the future, this method will handle it
     * This method returns the version as a SemVer object for comparison to find the highest version
     */
    private static async _getSqlPackageExecutableVersion(sqlPackagePath: string): Promise<semver.SemVer> {
        let versionOutput = '';
        await exec.exec(`"${sqlPackagePath}"`, ['/version'], {
            listeners: {
                stdout: (data: Buffer) => versionOutput += data.toString()
            }
        });

        let version = semver.coerce(versionOutput.trim());
        if (!semver.valid(version) || version === null) {
            core.debug(`Unable to parse version ${versionOutput} of SqlPackage at location ${sqlPackagePath}`);
            return new semver.SemVer('0.0.0');
        }

        return version;
    }

    private static async _getSqlPackageExeInstalledDotnetTool(): Promise<ISqlPackageInstall> {
        let globalDotnetToolsPath = path.join(process.env['USERPROFILE'] as string, '.dotnet', 'tools');
        let sqlPackagePath = path.join(globalDotnetToolsPath, 'SqlPackage.exe');
        if (fs.existsSync(sqlPackagePath)) {
            let sqlPackageVersion = await this._getSqlPackageExecutableVersion(sqlPackagePath);
            core.debug(`SqlPackage version ${sqlPackageVersion} (installed with dotnet tool) found at location: ${sqlPackagePath}`);
            return {
                sqlPackagePath: sqlPackagePath, 
                sqlPackageVersion: sqlPackageVersion
            };
        }

        return this._emptySqlPackageInstall();
    }

    private static async _getSqlPackageInstalledWithSSDT(): Promise<ISqlPackageInstall> {
        let visualStudioInstallationPath = await this._getLatestVisualStudioInstallationPath();
        if (!!visualStudioInstallationPath) {
            let dacParentDir = path.join(visualStudioInstallationPath, 'Common7', 'IDE', 'Extensions', 'Microsoft', 'SQLDB', 'DAC');
            let sqlPackageInstallationPath = this._getSqlPackageInVSDacDirectory(dacParentDir);
            if (!!sqlPackageInstallationPath[0]) {
                return sqlPackageInstallationPath;
            }
        }
        
        // locate SqlPackage in older versions
        let vsRegKey = path.join('\\', 'SOFTWARE', 'Microsoft', 'VisualStudio');
        let vsRegKeyWow6432 = path.join('\\', 'SOFTWARE', 'Wow6432Node', 'Microsoft', 'VisualStudio');

        if (!await AzureSqlActionHelper.registryKeyExists(vsRegKey)) {
            vsRegKey = vsRegKeyWow6432;
            if (!await AzureSqlActionHelper.registryKeyExists(vsRegKey)) {
                return this._emptySqlPackageInstall();
            }
        }

        let subKeys = await AzureSqlActionHelper.getRegistrySubKeys(vsRegKey);
        let vsVersionKeys = this._getVersionsRegistryKeys(subKeys);

        for (let vsVersionKey of vsVersionKeys) {
            let vsInstallDir = await AzureSqlActionHelper.getRegistryValue(vsVersionKey, 'InstallDir');
            let dacParentDir = path.join(vsInstallDir, 'Common7', 'IDE', 'Extensions', 'Microsoft', 'SQLDB', 'DAC');
            let sqlPackageInstallationPath = this._getSqlPackageInVSDacDirectory(dacParentDir);
            if (!!sqlPackageInstallationPath[0]) {
                return sqlPackageInstallationPath;
            }
        }

        core.debug('Dac Framework (installed with Visual Studio) not found on machine.');
        return this._emptySqlPackageInstall();
    }

    private static async _getSqlPackageInVSDacDirectory(dacParentDir: string): Promise<ISqlPackageInstall> {
        if (fs.existsSync(dacParentDir)) {
            let dacVersionDirs = fs.readdirSync(dacParentDir).filter((dir) => !isNaN(path.basename(dir) as any)).sort((dir1, dir2) => {
                let version1 = path.basename(dir1);
                let version2 = path.basename(dir2);

                if (version1 > version2) {
                    return -1;
                }
                else if (version1 < version2) {
                    return 1;
                }
                else {
                    return 0;
                }
            }).map((dir) => path.join(dacParentDir, dir));

            for (let dacDir of dacVersionDirs) {
                let sqlPackagePath = path.join(dacDir, 'SqlPackage.exe');
                if (fs.existsSync(sqlPackagePath)) {
                    let sqlPackageVersion = await this._getSqlPackageExecutableVersion(sqlPackagePath);
                    core.debug(`Dac Framework version ${sqlPackageVersion} installed with Visual Studio found at ${sqlPackagePath}`);
                    return {
                        sqlPackagePath: sqlPackagePath, 
                        sqlPackageVersion: sqlPackageVersion
                    };
                }
            }
        }

        return this._emptySqlPackageInstall();
    }

    private static async _getLatestVisualStudioInstallationPath(): Promise<string> {
        let vswherePath = path.join(process.env['ProgramFiles(x86)'] as string, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
        let stdout = '';
        try {
            await exec.exec(`"${vswherePath}"`, ['-latest', '-format', 'json'], {
                silent: true, 
                listeners: {
                    stdout: (data: Buffer) => stdout += data.toString()
                }
            });
        }
        catch (error) {
            core.debug(`Unable to find the location of latest Visual Studio Installation path using vswhere.exe. ${error}`)
            return '';
        }

        core.debug(stdout);
        let vswhereOutput: any = JSON.parse(stdout);
        return vswhereOutput[0] && vswhereOutput[0]['installationPath'];
    }

    private static async _getSqlPackageInstalledWithDacMsi(): Promise<ISqlPackageInstall> {
        let sqlDataTierFrameworkRegKey = path.join('\\', 'SOFTWARE', 'Microsoft', 'Microsoft SQL Server', 'Data-Tier Application Framework');
        let sqlDataTierFrameworkRegKeyWow6432 = path.join('\\', 'SOFTWARE', 'Wow6432Node', 'Microsoft', 'Microsoft SQL Server', 'Data-Tier Application Framework');
        
        if (!await AzureSqlActionHelper.registryKeyExists(sqlDataTierFrameworkRegKey)) {
            sqlDataTierFrameworkRegKey = sqlDataTierFrameworkRegKeyWow6432;
            if (!await AzureSqlActionHelper.registryKeyExists(sqlDataTierFrameworkRegKey)) {
                return this._emptySqlPackageInstall();
            }
        }

        let subKeys = await AzureSqlActionHelper.getRegistrySubKeys(sqlDataTierFrameworkRegKey); 
        let sqlServerRegistryKeys = this._getVersionsRegistryKeys(subKeys);

        for(let registryKey of sqlServerRegistryKeys) {
            let installDir = await AzureSqlActionHelper.getRegistryValue(registryKey, 'InstallDir');
            if (!!installDir) {
                let sqlPackagePath = path.join(installDir, 'SqlPackage.exe');
                if (fs.existsSync(sqlPackagePath)) {
                    let sqlPackageVersion = await this._getSqlPackageExecutableVersion(sqlPackagePath);
                    core.debug(`SqlPackage version ${sqlPackageVersion} (installed with DacFramework) found at location: ${sqlPackagePath}`);
                    return {
                        sqlPackagePath: sqlPackagePath, 
                        sqlPackageVersion: sqlPackageVersion
                    };
                }
            }
        }

        return this._emptySqlPackageInstall();
    }

    private static async _getSqlPackageInstalledWithSSMS(): Promise<ISqlPackageInstall> {
        let sqlServerRegistryKey = path.join('\\', 'SOFTWARE', 'Microsoft', 'Microsoft SQL Server');
        let sqlServerRegistryKeyWow6432 = path.join('\\', 'SOFTWARE', 'Wow6432Node', 'Microsoft', 'Microsoft SQL Server'); 
        
        if (!await AzureSqlActionHelper.registryKeyExists(sqlServerRegistryKey)) {
            sqlServerRegistryKey = sqlServerRegistryKeyWow6432;
            if (!await AzureSqlActionHelper.registryKeyExists(sqlServerRegistryKey)) {
                return this._emptySqlPackageInstall();
            }
        }

        let subKeys = await AzureSqlActionHelper.getRegistrySubKeys(sqlServerRegistryKey); 
        let sqlServerRegistryKeys = this._getVersionsRegistryKeys(subKeys);

        for(let registryKey of sqlServerRegistryKeys) {
            let versionSpecificRootDir = await AzureSqlActionHelper.getRegistryValue(registryKey, 'VerSpecificRootDir');
            if (!!versionSpecificRootDir) {
                let sqlPackagePath = path.join(versionSpecificRootDir, 'Dac', 'bin', 'SqlPackage.exe');
                if (fs.existsSync(sqlPackagePath)) {
                    let sqlPackageVersion = await this._getSqlPackageExecutableVersion(sqlPackagePath);
                    core.debug(`SqlPackage version ${sqlPackageVersion} (installed with SSMS) found at location: ${sqlPackagePath}`);
                    return {
                        sqlPackagePath: sqlPackagePath, 
                        sqlPackageVersion: sqlPackageVersion
                    };
                }
            }
        }

        return this._emptySqlPackageInstall();
    }

    /***
     * Get the registry keys of all versions installed, sorted in descending order of versions
     */
    private static _getVersionsRegistryKeys(subKeys: winreg.Registry[]): winreg.Registry[] {
        return subKeys.filter((registryKey) => !isNaN(registryKey.key.split("\\").slice(-1)[0] as any))
            .sort((registryKey1, registryKey2) => { 
                let version1 = parseInt(registryKey1.key.split("\\").slice(-1)[0]);
                let version2 = parseInt(registryKey2.key.split("\\").slice(-1)[0]);

                if (version1 > version2) {
                    return -1;
                }
                else if (version1 < version2) {
                    return 1;
                }
                else {
                    return 0;
                }
            }
        );
    }

    private static _emptySqlPackageInstall(): ISqlPackageInstall {
        return {
            sqlPackagePath: '',
            sqlPackageVersion: new semver.SemVer('0.0.0')
        }
    }

    private static _getSqlPackageBinaryPathLinux(): string {
        // check in dotnet tool default global path ~/.dotnet/tools
        if (fs.existsSync(dotnetLinuxPath)) {
            return dotnetLinuxPath;
        }

        // default on path
        return 'sqlpackage';
    }

    private static _getSqlPackageBinaryPathMac(): string {
        throw new Error('This action is not supported on a Mac environment.');
    }

    private static _sqlPackagePath = '';
}
```

## A.10 src/AzureSqlResourceManager.ts (ARM API Client)

```typescript
import { IAuthorizer } from 'azure-actions-webclient/Authorizer/IAuthorizer';
import { WebRequest } from 'azure-actions-webclient/WebClient';
import { ServiceClient as AzureRestClient, ToError, AzureError } from 'azure-actions-webclient/AzureRestClient'

// API docs: https://docs.microsoft.com/rest/api/sql
const SqlApiVersion = '2021-11-01';

export interface AzureSqlServer {
    id: string;
    kind: string;
    location: string;
    name: string;
    properties: {
        administratorLogin: string;
        administratorLoginPassword: string;
        fullyQualifiedDomainName: string;
        state: string;
        version: string;
    }
    type: string;
}

export interface FirewallRule {
    id: string;
    kind: string;
    location: string;
    name: string;
    type: string;
    properties: {
        startIpAddress: string;
        endIpAddress: string;
    }
}

export default class AzureSqlResourceManager {
    private constructor(resourceAuthorizer: IAuthorizer) {
        // making the constructor private, so that object initialization can only be done by the class factory GetResourceManager
        this._authorizer = resourceAuthorizer;
        this._restClient = new AzureRestClient(resourceAuthorizer);
    }

    public static async getResourceManager(serverName: string, resourceAuthorizer: IAuthorizer): Promise<AzureSqlResourceManager> {
        // a factory method to return asynchronously created object
        let resourceManager = new AzureSqlResourceManager(resourceAuthorizer);
        await resourceManager._populateSqlServerData(serverName);
        return resourceManager;
    }

    public getSqlServer() {
        return this._resource;
    }

    public async addFirewallRule(startIpAddress: string, endIpAddress: string): Promise<FirewallRule> {
        let today = new Date();
        let firewallRuleName = `ClientIPAddress_${today.getFullYear()}-${today.getMonth()}-${today.getDay()}_${startIpAddress}`;

        // https://docs.microsoft.com/rest/api/sql/2021-11-01/firewall-rules/create-or-update
        let httpRequest: WebRequest = {
            method: 'PUT',
            uri: this._restClient.getRequestUri(`/${this._resource!.id}/firewallRules/${firewallRuleName}`, {}, [], SqlApiVersion),
            body: JSON.stringify({
                'properties': {
                    'startIpAddress': startIpAddress,
                    'endIpAddress': endIpAddress
                }
            })
        };

        try {
            let httpResponse = await this._restClient.beginRequest(httpRequest);

            if (httpResponse.statusCode !== 200 && httpResponse.statusCode !== 201) {
                throw ToError(httpResponse);
            }

            return httpResponse.body as FirewallRule;
        }
        catch(error) {
            if (error instanceof AzureError) {
                throw new Error(JSON.stringify(error));
            }
            
            throw error;
        }
    }

    public async removeFirewallRule(firewallRule: FirewallRule): Promise<void> {
        // https://docs.microsoft.com/rest/api/sql/2021-11-01/firewall-rules/delete
        let httpRequest: WebRequest = {
            method: 'DELETE',
            uri: this._restClient.getRequestUri(`/${this._resource!.id}/firewallRules/${firewallRule.name}`, {}, [], SqlApiVersion)
        };

        try {
            let httpResponse = await this._restClient.beginRequest(httpRequest);

            if (httpResponse.statusCode !== 200 && httpResponse.statusCode !== 204) {
                throw ToError(httpResponse);
            }
        }
        catch(error) {
            if (error instanceof AzureError) {
                throw new Error(JSON.stringify(error));
            }
            
            throw error;
        }
    }

    private async _populateSqlServerData(serverName: string) {
        let sqlServerHostNameSuffix = this._authorizer.getCloudSuffixUrl('sqlServerHostname');
        if (serverName.endsWith(sqlServerHostNameSuffix)) {
            // remove the sqlServerHostname suffix from server url if it exists
            serverName = serverName.slice(0, serverName.lastIndexOf(sqlServerHostNameSuffix));
        }

        // https://docs.microsoft.com/rest/api/sql/2021-11-01/servers/list
        let httpRequest: WebRequest = {
            method: 'GET',
            uri: this._restClient.getRequestUri('//subscriptions/{subscriptionId}/providers/Microsoft.Sql/servers', {}, [], SqlApiVersion)
        }

        try {
            let httpResponse = await this._restClient.beginRequest(httpRequest);

            if (httpResponse.statusCode !== 200) {
                throw ToError(httpResponse);
            }

            let sqlServers = httpResponse.body && httpResponse.body.value as AzureSqlServer[];
            
            if (sqlServers && sqlServers.length > 0) {
                this._resource = sqlServers.filter((sqlResource) => sqlResource.name === serverName)[0];
                if (!this._resource) {
                    throw new Error(`Unable to get details of SQL server ${serverName}. Sql server '${serverName}' was not found in the subscription ${this._authorizer.subscriptionID}.`);
                }
            }
            else {
                throw new Error(`Unable to get details of SQL server ${serverName}. No SQL servers were found in the subscription ${this._authorizer.subscriptionID}.`);
            }
        }
        catch(error) {
            if (error instanceof AzureError) {
                throw new Error(JSON.stringify(error));
            }
            
            throw error;
        }
    }

    private _resource?: AzureSqlServer;
    private _restClient: AzureRestClient;
    private _authorizer: IAuthorizer;
}
```

---

**END OF DOCUMENT**

**Last Updated:** 2026-07-17  
**Status:** Ready for 2-week development sprint  
**Next Steps:** Begin Phase 1 (Days 1-3) - Foundation

---

## Pull Requests

### Big combined PR (draft — CI/testing sandbox only)
[feat: Add MicrosoftSqlDeploymentV1 task #22373](https://github.com/microsoft/azure-pipelines-tasks/pull/22373)
