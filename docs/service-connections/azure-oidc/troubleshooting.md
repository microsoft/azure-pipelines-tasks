## Pages

#### [Getting Started](README.md)
#### [Manual Configuration](manual-configuration.md)

# Workload Identity federation - Troubleshooting & Frequently Asked Questions

## Task coverage

The following table lists [tasks](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines") using the [Azure Service Connection](https://learn.microsoft.com/azure/devops/pipelines/library/connect-to-azure?view=azure-devops "https://learn.microsoft.com/azure/devops/pipelines/library/connect-to-azure?view=azure-devops"), and which ring they're on. Marketplace tasks do not support Workload identity federation during preview.

| TaskFullName | Status |
| --- |  --- |
| AzureAppServiceManageV0 | Available |
| AzureAppServiceSettingsV1 | Available |
| AzureCLIV1 | Available |
| AzureCLIV1 | Available |
| AzureCLIV2 | Available |
| AzureCLIV2 | Available |
| AzureCloudPowerShellDeploymentV1 | Use AzureCloudPowerShellDeploymentV2 for OIDC |
| AzureCloudPowerShellDeploymentV2 | Not available yet |
| AzureContainerAppsV0 | Available |
| AzureContainerAppsV1 | Available |
| AzureFileCopyV1 | AzCopy v7 does not support OIDC |
| AzureFileCopyV2 | AzCopy v7 does not support OIDC |
| AzureFileCopyV3 | AzCopy v7 does not support OIDC |
| AzureFileCopyV4 | AzCopy v10 does not support OIDC yet |
| AzureFileCopyV5 | AzCopy v10 does not support OIDC yet |
| AzureFunctionAppContainerV1 | Available |
| AzureFunctionAppV1 | Available |
| AzureFunctionAppV2 | Available |
| AzureFunctionOnKubernetesV1 | Not available yet |
| AzureIoTEdgeV2 | Not available yet |
| AzureKeyVaultV1 | Available |
| AzureKeyVaultV2 | Available |
| AzureMonitorAlertsV0 | Task is deprecated |
| AzureMonitorV0 | Available |
| AzureMonitorV1 | Available |
| AzureMysqlDeploymentV1 | Available |
| AzureNLBManagementV1 | Task is deprecated |
| AzurePolicyV0 | Available |
| AzurePowerShellV2 | Available |
| AzurePowerShellV3 | Available |
| AzurePowerShellV4 | Available |
| AzurePowerShellV5 | Available |
| AzurePowerShellV5 | Available |
| AzureResourceGroupDeploymentV2 | Available |
| AzureResourceManagerTemplateDeploymentV3 | Available |
| AzureRmWebAppDeploymentV3 | Available |
| AzureRmWebAppDeploymentV4 | Available |
| AzureSpringCloudV0 | Available |
| AzureVmssDeploymentV0 | Available |
| AzureWebAppContainerV1 | Available |
| AzureWebAppV1 | Available |
| DockerComposeV0 | Not available yet |
| DockerV0 | Not available yet |
| DockerV1 | Not available yet |
| HelmDeployV0 | Available |
| InvokeRestApiV1 | Available |
| JavaToolInstallerV0 | Not available yet |
| JenkinsDownloadArtifactsV1 | Not available yet |
| KubernetesV1 | Available |
| PackerBuildV0 | Packer does not support OIDC yet |
| PackerBuildV1 | Packer does not support OIDC yet |
| ServiceFabricComposeDeployV0 | Service Fabric does not support OIDC |
| ServiceFabricDeployV1 | Service Fabric does not support OIDC |

## Error messages

The following table contains a list of known error messages and:

| Message | Plausible issue |
|---------|-----------------|
| *cannot request token: Get "?audience=api://AzureADTokenExchange": unsupported protocol scheme* | Task does not support Workload Identity federation |
| *Identity not found* | Task does not support Workload Identity federation |
| *Could not fetch access token for Azure* | Task does not support Workload Identity federation |
| \<Task\> *only support(s) service principal authorization* | Task does not support Workload Identity federation |
| *AADSTS70021: No matching federated identity record found for presented assertion. Assertion Issuer: 'https://app.vstoken.visualstudio.com'. Assertion Subject: 'sc://\<org\>/\<project\>/\<service-connection\>'.* | Either the issuer url or federation subject does not match. This can happen when the Azure DevOps organization or project have been renamed, or a manually created service connection was renamed without updating the federation subject on the identity. |
| *AADSTS700223* | Workload Identity federation has been disabled on the AAD tenant |
| *AADSTS700024: Client assertion is not within its valid time range* | You're using the AzureCLI task with `addSpnToEnvironment: true` to consume the `idToken` environment variable. The `idToken` has expired after 10 minutes. |


## Limitations & Known Issues

-   During private preview, breaking changes may be introduced.
-   Support for Azure Service Connections only.
-   We plan to implement a breaking change around early July, which will require Workload Identity Service Connections to be updated or recreated.
-   Azure Tasks included with [Azure DevOps Azure Tasks](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines") only, no support for Marketplace extension Tasks yet.
-   AzCopy & Packer do not support Workload identity federation. The [AzureFileCopy](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-file-copy-v5?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-file-copy-v5?view=azure-pipelines") and [PackerBuild](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/packer-build-v1?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/packer-build-v1?view=azure-pipelines") tasks will be updated once the underlying tools receive support.
-   Not all 'in-the-box' [tasks](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines") have rolled out yet (see above).
-   Convert does not validate whether pipelines consuming the Service Connection use unsupported tasks, have jobs that are in flight, or have a secret that is consumed in the [AzureCLI](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-cli-v2?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-cli-v2?view=azure-pipelines") task (`addSpnToEnvironment`). As a result, converted Service Connections may have to be reverted back if there is a dependency on `addSpnToEnvironment` or tasks/tools that do not support OIDC.
-   Using User-assigned Managed Identity is not available in all Azure regions, see [unsupported regions](https://learn.microsoft.com/azure/active-directory/workload-identities/workload-identity-federation-considerations#unsupported-regions-user-assigned-managed-identities).

## Frequently Asked Questions

1.  Q: I have an issue or question not being covered here, how can I get into contact?  
    A: Please reach out over email to <azdooidcpreview@service.microsoft.com>.
1.  Q: Can I still use Azure Service Connections with Service Principal secrets?  
    ​​​​​​​A: Yes.
1.  Q: I have a(nother) organization who I would like to join the preview, how can they get access?  
    A: Access requests can be submitted here: <https://aka.ms/azdo-rm-workload-identity-preview>.
1.  Q: I can't select Workload Identity federation when creating a new Azure Service Connection. How can I make it available?  
    A: Make sure the preview feature Workload Identity federation for ARM service connections is enabled for your organization, see [manage or enable features](https://learn.microsoft.com/azure/devops/project/navigation/preview-features?view=azure-devops&=&tabs=new-account-enabled)
1.  Q: I can't enable features for my organization. How can I find out who can?  
    A: Features can be enabled by organization admins. You can find organization owners on the organization settings page (`https://dev.azure.com/<org>/_settings/organizationOverview`)
1.  Q: I don't have permissions to create a Service Principal in the Azure Active Directory tenant I use, what can I do?  
    A: Please follow the [instructions for manual configuration](manual-configuration.md).
1.  Q: I don't see 'Federated credentials' under Service Principal 'Certificates & secrets' the Azure Portal, what can I do?  
    A: Disable any adBlocker browser extensions you may use and/or refresh the browser.
1.  Q: I'm manually configuring a Service Connection but do not know what to provide for issuer URL, what should I enter?  
    A: The issuer URL is `https://app.vstoken.visualstudio.com` (without trailing '/'). In an upcoming change this will be updated to include an Azure DevOps specific identifier.
1.  Q: I'm using an Azure Active Directory credential to connect to Azure Container Registry with the Docker Service Connection, AKS with the Kubernetes Service Connection or Azure Service Fabric with the Service Fabric Service Connection. Is this available?  
    A: For tasks targeting AKS, you can use the Azure Service Connection. We will update the Docker Registry Service Connection later.
1.  Q: I converted a Service Connection to use Workload Identity federation. However, now I have broken pipelines.  
    A: You may be using tasks that do not yet support Workload identity federation. A Service Connection that has been converted to use Workload identity federation can be reverted back for 2 months. Converting the Service Connection back to use a secret should address any issues that were the result of the conversion to use Workload identity federation.
1.  Q: I'm using the [AzureCLI](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-cli-v2?view=azure-pipelines) task with `addSpnToEnvironment: true` to get the Service Principal credentials and login with another tool.  
    A: There is no Service Principal secret. You can set `addSpnToEnvironment: true` on the AzureCLI task to have the `idToken` environment variable populated. Tools that support Workload identity federation can consume this token. Put any code that consumes the `idToken` at the start of your script. The `idToken` is valid for 10 minutes, you'll receive a `AADSTS700024` message if you try to use an expired token. 
1.  Q: I'm not using Azure, but another service that supports Workload identity federation. When can I use that?  
    A: Marketplace tasks that use Service Connections can be updated to use Workload Identity federation later.
1.  Q: I'm using Service Connections to access Sovereign clouds (e.g. Azure China), can I use Workload Identity federation?  
    A: Yes
1.  Q: I'm using Azure DevOps Server, when will I be able to use Workload Identity federation?  
    A: There are no plans to make Workload Identity federation available on Azure DevOps Server
1.  Q: Can I create a Service Connection that uses Workload Identity federation through a REST API?  
    A: Yes, you can use the [REST API](https://learn.microsoft.com/rest/api/azure/devops/serviceendpoint/endpoints/create?view=azure-devops-rest-7.1&tabs=HTTP "https://learn.microsoft.com/rest/api/azure/devops/serviceendpoint/endpoints/create?view=azure-devops-rest-7.1&tabs=HTTP"). Here is a sample [script](https://github.com/geekzter/azure-pipeline-scripts/blob/586e6dd5bd84c9f7985ecc1501d76f2b6f87022b/scripts/create_azurerm_msi_oidc_service_connection.ps1#L277) and [request](https://github.com/geekzter/azure-pipeline-scripts/blob/main/scripts/serviceEndpointRequest.json).
1.  Q: Can I use a Managed Identity instead of a Service Principal to set up Workload Identity federation?  
    A: Yes, it is possible to use [Managed Identity for Workload Identity federation](https://learn.microsoft.com/en-us/azure/active-directory/workload-identities/workload-identity-federation-create-trust-user-assigned-managed-identity?pivots=identity-wif-mi-methods-azp). To set this up, use the [manual configuration](https://github.com/microsoft/azure-pipelines-tasks/blob/users/geekzter/oidc-preview-docs/docs/service-connections/azure-oidc/manual-configuration.md#federated-managed-identity) and populate `clientId`, `tenantId` from the Managed Identity's properties. [Here is a sample script](https://github.com/geekzter/azure-pipeline-scripts/blob/main/scripts/create_azurerm_msi_oidc_service_connection.ps1) to configure a Service Connection with a Federated Managed Identity.
1.  Q: I'm using Terraform, how can I use Workload Identity federation?  
    A: There are 3 methods to use Terraform with OIDC:
       - We have added the `idToken` environment variable with the AzureCLI@2 task and `addSpnToEnvironment: true`. This will enable you to assign the [`ARM_OIDC_TOKEN`](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/guides/service_principal_oidc#configuring-the-service-principal-in-terraform) environment variable consumed by the [azuread](https://registry.terraform.io/providers/hashicorp/azuread/latest/docs#argument-reference) & [azurerm](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/guides/service_principal_oidc#configuring-the-service-principal-in-terraform) providers:  
         `ARM_OIDC_TOKEN = idToken`  
         `ARM_USE_OIDC = 'true'`
       - Use the end-to-end sample at [Azure-Samples/azure-devops-terraform-oidc-ci-cd](https://github.com/Azure-Samples/azure-devops-terraform-oidc-ci-cd/tree/main).
       - Using one of the Terraform tasks from the Marketplace. We are making changes to task developers can obtain the token. Once that has completed the [DevLabs Terraform](https://marketplace.visualstudio.com/items?itemName=ms-devlabs.custom-terraform-tasks) and other extensions will be updated.
1.  Q: I'm using AWS, how can I use Workload Identity federation?  
    A: During the preview, we only support Azure Service Connections. Marketplace tasks that come with their own Service Connection will be supported at a later point in time.
