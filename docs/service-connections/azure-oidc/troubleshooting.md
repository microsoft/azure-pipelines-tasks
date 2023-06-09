# Workload Identity federation - Troubleshooting

## Task coverage

The following table lists [tasks](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines") using the [Azure Service Connection](https://learn.microsoft.com/azure/devops/pipelines/library/connect-to-azure?view=azure-devops "https://learn.microsoft.com/azure/devops/pipelines/library/connect-to-azure?view=azure-devops"), and which ring they're on. Marketplace tasks do not support Workload identity federation during preview.

| Task | Status |
| --- |  --- |
| AzureAppServiceManageV0 | Ring 5 |
| AzureAppServiceSettingsV1 | Ring 5 |
| AzureCLIV1 with addSpnToEnvironment | Not deployed yet |
| AzureCLIV2 with addSpnToEnvironment | Not deployed yet |
| AzureCLIV1 | Ring 5 |
| AzureCLIV2 | Ring 5 |
| AzureCloudPowerShellDeploymentV1 | Not deployed yet |
| AzureCloudPowerShellDeploymentV2 | Not deployed yet |
| AzureContainerAppsV0 | Ring 5 |
| AzureContainerAppsV1 | Not deployed yet |
| AzureFileCopyV1 | AzCopy v7 does not support OIDC |
| AzureFileCopyV2 | AzCopy v7 does not support OIDC |
| AzureFileCopyV3 | AzCopy v7 does not support OIDC |
| AzureFileCopyV4 | AzCopy v10 does not support OIDC yet |
| AzureFileCopyV5 | AzCopy v10 does not support OIDC yet |
| AzureFunctionAppContainerV1 | Not deployed yet |
| AzureFunctionAppV1 | Not deployed yet |
| AzureFunctionAppV2 | Not deployed yet |
| AzureFunctionOnKubernetesV1 | Not deployed yet |
| AzureIoTEdgeV2 | Not deployed yet |
| AzureKeyVaultV1 | Ring 5 |
| AzureKeyVaultV2 | Ring 5 |
| AzureMonitorAlertsV0 | Task is deprecated |
| AzureMonitorV0 | Ring 5 |
| AzureMonitorV1 | Ring 5 |
| AzureMysqlDeploymentV1 | Ring 5 |
| AzureNLBManagementV1 | Task is deprecated |
| AzurePolicyV0 | Ring 5 |
| AzurePowerShellV2 | Ring 5 |
| AzurePowerShellV3 | Ring 5 |
| AzurePowerShellV4 | Ring 5 |
| AzurePowerShellV5 | Ring 5 |
| AzureResourceGroupDeploymentV2 | Ring 5 |
| AzureResourceManagerTemplateDeploymentV3 | Ring 5 |
| AzureRmWebAppDeploymentV3 | Ring 5 |
| AzureRmWebAppDeploymentV4 | Ring 5 |
| AzureSpringCloudV0 | Ring 5 |
| AzureVmssDeploymentV0 | Ring 5 |
| AzureWebAppContainerV1 | Not deployed yet |
| AzureWebAppV1 | Not deployed yet |
| HelmDeployV0 | Not deployed yet |
| InvokeRestApiV1 | Ring 5 |
| KubernetesManifestV1 | Not deployed yet |
| KubernetesV1 | Not deployed yet |
| PackerBuildV0 | Packer does not support OIDC yet |
| PackerBuildV1 | Packer does not support OIDC yet |
| SqlAzureDacpacDeploymentV1 | Ring 5 |

## Error messages

The following messages indicate a task does not support Workload Identity federation:

-   *cannot request token: Get "?audience=api://AzureADTokenExchange": unsupported protocol scheme*
-   *Identity not found*
-   *Could not fetch access token for Azure*
-   \<Task\> *only support(s) service principal authorization*

## Limitations

-   During private preview, breaking changes may be introduced.
-   Support for Azure Service Connections only.
-   We plan to implement a breaking change around Mid-June, which will require Workload Identity Service Connections to be updated or recreated.
-   Azure Tasks included with [Azure DevOps Azure Tasks](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines") only, no support for Marketplace extension Tasks yet.
-   AzCopy & Packer do not support Workload identity federation. The [AzureFileCopy](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-file-copy-v5?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-file-copy-v5?view=azure-pipelines") and [PackerBuild](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/packer-build-v1?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/packer-build-v1?view=azure-pipelines") tasks will be updated once the underlying tools receive support.
-   Not all 'in-the-box' [tasks](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/?view=azure-pipelines") have rolled out yet (see overview).
-   There is no method to 'grab' credentials similar to [`addSpnToEnvironment`](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-cli-v2?view=azure-pipelines#inputs "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-cli-v2?view=azure-pipelines#inputs") yet.
-   Convert does not validate whether pipelines consuming the Service Connection use unsupported tasks, have jobs that are in flight, or have a secret that is consumed in the [AzureCLI](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-cli-v2?view=azure-pipelines "https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-cli-v2?view=azure-pipelines") task (`addSpnToEnvironment`). As a result, converted Service Connections may have to be reverted back if there is a dependency on `addSpnToEnvironment` or tasks/tools that do not support OIDC.
https://build.microsoft.com/en-US/sessions/649603cd-c704-4222-bbcf-10c14b739bf9?source=/schedule
## Frequently Asked Questions

-   Q: Can I still use Azure Service Connections with Service Principal secrets?  
    ​​​​​​​A: Yes.
-   Q: I can't select Workload Identity federation when creating a new Azure Service Connection. How can I make it available?  
    A: Make sure the preview feature Workload Identity federation for ARM service connections is enabled for your organization, see [manage or enable features](https://learn.microsoft.com/azure/devops/project/navigation/preview-features?view=azure-devops&=&tabs=new-account-enabled)
-   Q: I can't enable features for my organization. How can I find out who can?  
    A: Features can be enabled by organization admins. You can find organization owners on the organization settings page (`https://dev.azure.com/<org>/_settings/organizationOverview`)
-   Q: I don't have permissions to create a Service Principal in the Azure Active Directory tenant, what can I do?  
    A: Please follow the [instructions for manual configuration](https://microsofteur.sharepoint.com/teams/azdo-rm/SitePages/Manual-Configuration.aspx "https://microsofteur.sharepoint.com/teams/azdo-rm/SitePages/Manual-Configuration.aspx").
-   Q: I don't see 'Federated credentials' under Service Principal 'Certificates & secrets' the Azure Portal, what can I do?  
    A: Refresh the browser and disable any adBlocker browser extensions you may use.
-   Q: I'm manually configuring a Service Connection but do not know what to provide for issuer URL, what should I enter?  
    A: The issuer URL is [https://app.vstoken.visualstudio.com](https://app.vstoken.visualstudio.com/) (without trailing '/'). In an upcoming change this will be expanded to include an Azure DevOps specific identifier.
-   Q: I'm using an Azure Active Directory credential to connect to Azure Container Registry with the docker Service Connection, AKS with the Kubernetes Service Connection or Azure Service Fabric with the Service Fabric Service Connection. Is this available?  
    A: We will support Azure tasks not using the Azure Service Connection later in the year.
-   Q: I converted a Service Connection to use Workload Identity federation. However, now I have broken pipelines.  
    A: You may be using tasks that do not yet support Workload identity federation. A Service Connection that has been converted to use Workload identity federation can be reverted back for 2 months. Converting the Service Connection back to use a secret should address any issues that were the result of the conversion to use Workload identity federation.
-   Q: I'm using the [AzureCLI](https://learn.microsoft.com/azure/devops/pipelines/tasks/reference/azure-cli-v2?view=azure-pipelines) task with `addSpnToEnvironment: true` to get the Service Principal credentials and login with another tool.  
    A: There is no longer a Service Principal secret. We will update the AzureCLI task to add the federated token as an environment variable. Tools that support Workload identity federation can consume this token.
-   Q: I'm not using Azure, but another service that supports Workload identity federation. When can I use that?
    A: Marketplace tasks that use Service Connections can be updated to use Workload Identity federation later in the year.
-   Q: I'm using Service Connections to access Sovereign clouds (e.g. Azure China), can I use Workload Identity federation?  
    A: Yes
-   Q: I'm using Azure DevOps Server, when will I be able to use Workload Identity federation?  
    A: There are no plans to make Workload Identity federation available on Azure DevOps Server
-   Q: I have an issue or question not being covered here, how can I get into contact?  
    A: Please reach out over email to <azdooidcpreview@service.microsoft.com>.
-   Q: I want to grant other people in my organization access to this page, how can I request that?  
    A: Please send a request to <azdooidcpreview@service.microsoft.com>.
-   Q: I have a(nother) organization who I would like to join the preview, how can they get access?  
    A: Access requests can be submitted here: <https://aka.ms/azdo-rm-workload-identity-preview>.
-   Q: Can I create a Service Connection that uses Workload Identity federation through a REST API?  
    A: Yes, you can use the [REST API](https://learn.microsoft.com/rest/api/azure/devops/serviceendpoint/endpoints/create?view=azure-devops-rest-7.1&tabs=HTTP "https://learn.microsoft.com/rest/api/azure/devops/serviceendpoint/endpoints/create?view=azure-devops-rest-7.1&tabs=HTTP"). Simply remove the *serviceprincipalkey* attribute. Before making the request, you first need to create a Service Principal with the right federated credential. This can be done with the [Azure CLI](https://learn.microsoft.com/cli/azure/ad/app/federated-credential?view=azure-cli-latest#az-ad-app-federated-credential-create "https://learn.microsoft.com/cli/azure/ad/app/federated-credential?view=azure-cli-latest#az-ad-app-federated-credential-create") or [Microsoft Graph API](https://learn.microsoft.com/graph/api/application-post-federatedidentitycredentials?view=graph-rest-1.0&tabs=http "https://learn.microsoft.com/graph/api/application-post-federatedidentitycredentials?view=graph-rest-1.0&tabs=http"). The federated subject needs to match the Service Connection name: `sc://<org name>/<project name>/<service connection name>`.

## More information

Other pages with information on Workload Identity federation:

- [Getting Started](README.md)
- [Manual Configuration](manual-configuration.md)
