# Bicep Deploy Task

## Overview

The Bicep Deploy task is used to deploy and manage Azure resources using [Bicep](https://learn.microsoft.com/azure/azure-resource-manager/bicep/overview) files. Bicep is a domain-specific language (DSL) that uses declarative syntax to deploy Azure resources. This task supports both standard Azure deployments and [Azure Deployment Stacks](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deployment-stacks), providing a simplified and more maintainable way to manage your Azure infrastructure as code.

The task handles:
- Creating or updating Azure resources using Bicep templates
- Validating Bicep templates before deployment
- Previewing changes with What-If operations
- Managing deployment stacks with lifecycle policies
- Deleting deployments and deployment stacks
- Installing and managing Bicep CLI versions automatically

## Features

- **Native Bicep Support**: Direct deployment from `.bicep` and `.bicepparam` files without requiring pre-compilation to ARM templates
- **Deployment Stacks**: Full support for Azure Deployment Stacks with deny settings, unmanaged resource policies, and lifecycle management
- **Automatic Bicep CLI Management**: Automatically downloads and caches the specified version of Bicep CLI
- **Cross-Platform**: Works with Windows, Linux, and macOS agents
- **Multiple Deployment Scopes**: Supports Resource Group, Subscription, Management Group, and Tenant scopes
- **What-If Operations**: Preview changes before applying them to your Azure environment
- **Flexible Parameter Input**: Support for inline YAML/JSON parameters and traditional parameter files
- **Output Masking**: Automatically mask sensitive outputs like secrets and connection strings

## Prerequisites

### Azure Subscription

To deploy to Azure, an Azure subscription must be linked to Azure Pipelines using a service connection:

1. Navigate to **Project Settings** → **Service connections**
2. Create a new service connection of type **Azure Resource Manager**
3. Choose authentication method:
   - **Service Principal (automatic)** - Recommended for most scenarios
   - **Service Principal (manual)** - For advanced configurations
   - **Managed Identity** - For Azure-hosted agents with managed identities
   - **Workload Identity Federation** - For enhanced security without secrets

For troubleshooting service connections, refer to the [Azure RM endpoint documentation](https://learn.microsoft.com/azure/devops/pipelines/library/connect-to-azure).

### Agent Requirements

- **Minimum Agent Version**: 2.144.0
- **Supported OS**: Windows, Linux, macOS
- **Node.js**: Node.js 20 or higher (included in modern hosted agents)
- **Bicep CLI**: Automatically installed by the task (no manual installation required)

## Parameters

The table below lists all task inputs. Required inputs are marked with **\***.

### Core Parameters

| Input Name | Required | Description | Allowed Values |
|------------|----------|-------------|----------------|
| `type` | Yes | Deployment model to use | `deployment` (standard ARM deployment)<br>`deploymentStack` (with lifecycle management) |
| `operation` | Yes | Action to perform | `create`<br>`validate`<br>`whatIf` (Deployment only)<br>`delete` |
| `scope` | Yes | Scope for the deployment | `resourceGroup`<br>`subscription`<br>`managementGroup`<br>`tenant` |
| `name` | No | Name for the deployment or stack. Auto-generated if not provided. | Any valid string |
| `azureResourceManagerConnection` | Yes | Azure Resource Manager service connection | Service connection name |
| `subscriptionId` | Conditional | Target Azure subscription (required for Resource Group and Subscription scopes) | Subscription ID |
| `resourceGroupName` | Conditional | Target resource group name (required for Resource Group scope) | Resource group name |
| `location` | Conditional | Azure region for deployment metadata (required for Subscription, Management Group, and Tenant scopes) | Azure region name |
| `tenantId` | Conditional | Azure AD tenant ID (required for Tenant scope) | Tenant GUID |
| `managementGroupId` | Conditional | Management group identifier (required for Management Group scope) | Management group ID |

### Template Parameters

| Input Name | Required | Description | Allowed Values |
|------------|----------|-------------|----------------|
| `templateFile` | No | Path to the Bicep template file | File path (`.bicep`) |
| `parametersFile` | No | Path to the parameters file | File path (`.json` or `.bicepparam`) |
| `parameters` | No | Inline parameter values that override parameters file. Accepts JSON or YAML format. | JSON or YAML object |

**Note**: Follow [Azure Naming Guidelines](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/naming-and-tagging) when specifying resource names in parameters:

| Resource Type | Length | Casing | Valid Characters | Globally Unique |
|--------------|--------|--------|------------------|-----------------|
| Storage Account | 3-24 | lowercase | alphanumeric | Yes |
| Resource Group | 2-64 | case-insensitive | alphanumeric, periods, underscores, hyphens, parentheses (cannot end in period) | No |
| Key Vault | 3-24 | case-insensitive | alphanumeric and hyphens | Yes |
| DNS Name | 3-63 | lowercase | alphanumeric and hyphens | Yes |

### Deployment Stack Parameters

These inputs apply when `type` is set to `deploymentStack`.

| Input Name | Required | Description | Allowed Values |
|------------|----------|-------------|----------------|
| `actionOnUnmanageResources` | Yes (for stacks) | Action for resources not in template | `detach` (default - keep resources but remove from stack)<br>`delete` (delete unmanaged resources) |
| `actionOnUnmanageResourceGroups` | No | Action for unmanaged resource groups (Subscription/Management Group/Tenant scopes only) | `Detach`<br>`Delete` |
| `actionOnUnmanageManagementGroups` | No | Action for unmanaged management groups (Tenant scope only) | `Detach`<br>`Delete` |
| `denySettingsMode` | Yes (for stacks) | Protection level against unauthorized changes | `none` (default - no protection)<br>`denyDelete` (prevent deletion)<br>`denyWriteAndDelete` (prevent modification and deletion) |
| `denySettingsExcludedActions` | No | Comma-separated list of Azure RBAC actions excluded from deny settings | e.g., `Microsoft.Compute/virtualMachines/write` |
| `denySettingsExcludedPrincipals` | No | Comma-separated list of Azure AD principal IDs excluded from deny settings | Azure AD principal GUIDs |
| `denySettingsApplyToChildScopes` | No | Apply deny settings to child resource scopes | `true`<br>`false` |
| `bypassStackOutOfSyncError` | No | Skip errors when stack is out of sync with Azure resources | `true`<br>`false` |

### Advanced Parameters

| Input Name | Required | Description | Allowed Values |
|------------|----------|-------------|----------------|
| `description` | No | Description text for the deployment or stack | Any string |
| `tags` | No | Tags as JSON or YAML object (Deployment Stack only) | JSON or YAML object |
| `bicepVersion` | No | Specific Bicep CLI version to use. Uses latest stable version if empty. | Version string (e.g., `0.30.23`) |
| `maskedOutputs` | No | Comma-separated list of output names to mask in logs for security | e.g., `connectionString,adminPassword` |
| `environment` | No | Target Azure cloud environment | `azureCloud` (default)<br>`azureChinaCloud`<br>`azureGermanCloud`<br>`azureUSGovernment` |
| `whatIfExcludeChangeTypes` | No | Comma-separated change types to exclude from What-If output (What-If operation only) | e.g., `NoChange,Ignore` |
| `validationLevel` | No | Template validation level (Validate and What-If operations only) | `provider`<br>`template`<br>`providerNoRbac` |

## Usage Examples

### Example 1: Basic Deployment

```yaml
- task: BicepDeploy@0
  displayName: 'Deploy Bicep Template'
  inputs:
    azureResourceManagerConnection: 'Azure-Connection'
    subscriptionId: '$(subscriptionId)'
    resourceGroupName: 'my-resource-group'
    templateFile: 'infra/main.bicep'
    parametersFile: 'infra/main.bicepparam'
```

### Example 2: Deployment Stack

```yaml
- task: BicepDeploy@0
  displayName: 'Deploy with Stack Protection'
  inputs:
    type: 'deploymentStack'
    operation: 'create'
    name: 'production-stack'
    azureResourceManagerConnection: 'Azure-Connection'
    subscriptionId: '$(subscriptionId)'
    resourceGroupName: 'production-rg'
    templateFile: 'infra/main.bicep'
    parametersFile: 'infra/production.bicepparam'
    actionOnUnmanageResources: 'delete'
    denySettingsMode: 'denyWriteAndDelete'
```

### Example 3: Subscription-Level Deployment

```yaml
- task: BicepDeploy@0
  displayName: 'Deploy Subscription Resources'
  inputs:
    scope: 'subscription'
    azureResourceManagerConnection: 'Azure-Connection'
    subscriptionId: '$(subscriptionId)'
    location: 'eastus'
    templateFile: 'infra/subscription.bicep'
    parametersFile: 'infra/subscription.bicepparam'
```

## Deployment Outputs

The task automatically creates pipeline variables for all outputs defined in your Bicep template. These variables can be used in subsequent tasks.

**Defining Outputs in Bicep**

Outputs are defined in the Bicep template using the `output` keyword. For example:

```bicep
output storageAccountName string = storageAccount.name
output webAppUrl string = webApp.properties.defaultHostName
output intOutput int = 42
output objectOutput object = {
  key1: 'value1'
  key2: 'value2'
}
```

For detailed guidance, refer to the [Bicep Outputs documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/outputs).

**How Outputs Become Available**

After the deployment completes successfully, all outputs are automatically converted to Azure Pipelines variables with the same names as defined in your Bicep template. These variables are created at the pipeline level and can be directly referenced in subsequent tasks using the standard variable syntax: `$(outputName)`.

### Accessing Outputs in PowerShell

```yaml
- task: BicepDeploy@0
  displayName: 'Deploy Infrastructure'
  inputs:
    azureResourceManagerConnection: 'Azure-Connection'
    subscriptionId: '$(subscriptionId)'
    resourceGroupName: 'my-resource-group'
    templateFile: 'infra/main.bicep'

- task: PowerShell@2
  displayName: 'Use Deployment Outputs'
  inputs:
    targetType: 'inline'
    script: |
      Write-Host "Storage Account Name: $(storageAccountName)"
      Write-Host "Web App URL: $(webAppUrl)"
```

### Accessing Outputs in Bash

```yaml
- task: BicepDeploy@0
  displayName: 'Deploy Infrastructure'
  inputs:
    azureResourceManagerConnection: 'Azure-Connection'
    subscriptionId: '$(subscriptionId)'
    resourceGroupName: 'my-resource-group'
    templateFile: 'infra/main.bicep'

- task: Bash@3
  displayName: 'Use Deployment Outputs'
  inputs:
    targetType: 'inline'
    script: |
      echo "Storage Account Name: $(storageAccountName)"
      echo "Web App URL: $(webAppUrl)"
```

## Feedback and Support

Please report issues or request features at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html).

For Bicep-specific questions and issues, refer to:
- [Bicep Documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)
- [Bicep GitHub Repository](https://github.com/Azure/bicep)
- [Azure Deployment Stacks Documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deployment-stacks)