## Pages

#### [Getting Started](README.md)
#### [Troubleshooting & Frequently Asked Questions](troubleshooting.md)

# Workload Identity federation (preview) - Manual Configuration

In case a user does not have the permission to create Service Principals, or the Azure Active Directory tenant of the Service Connection is different from the user's tenant, you need create the Service Principal used by the Service Connection manually. Below are the steps needed to set that up.

## Create Service Connection (step 1)

The service connection creation process is two-step.
In the first step, enter the service connection name and optional description.
Press next and this will bring you to the second step.

![image](https://github.com/microsoft/azure-pipelines-tasks/assets/3975111/04ded151-b739-433a-8f7d-773485fb4c26)


## Create Service Principal in Azure

-   Go to the [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps) or [Azure Active Directory Portal](https://aad.portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps)
-   Click on the 'New registration' link:
    </br><img src="new-app-reg.png" width="133"/>
-   Give the new App Registration a name and create but do not close the window as you will need to enter some details from here in the service connection.

## Create Service Connection (step 2)
-   Enter the following details into the service connection creation panel:
    - Copy the `Application (client) ID` field from the `Overview` blade of the `App registration` page and paste this into the `Service Principal Id` field in the service connection creation panel.
    - Copy the `Directory (tenant) ID` field from the `Overview` blade of the `App registration` page and paste this into the `Tenant ID` field in the service connection creation panel.
      ![image](https://github.com/microsoft/azure-pipelines-tasks/assets/3975111/ae400486-7e2b-4d20-b008-881b967d5433)

-   Navigate to 'Certificates & secrets' of the `App registration` you created:
    </br><img src="certificates-and-secrets.png" width="158"/>
-   Select 'Federated Credentials':
    </br><img src="federated-credentials.png" width="161"/></br>
    (Note: if you don't see 'Federated credentials', disable any adblocker browser extensions you may use and refresh your browser)
-   Select 'Add Credentials' and then 'Other issuer'
    - Copy the `Issuer` field from the service connection creation panel, for example `https://vstoken.dev.azure.com/6804a3a0-e94c-41ae-9343-c5676fd58375` (no trailing '/') and paste it into the `Issuer` field in Azure `Add a credential` blade. Note that the issuer is unique for every Azure DevOps organization.
    - Copy the `Subject identifier` field from the service connection creation panel, for example `sc://ggurgulr0/workload-identity-federation1/mySc`
    (this is sc://`your organization name`/`your project name`/`your service connection name`) and paste it into the `Subject identifier` field in Azure `Add a credential` blade
    ![Zrzut ekranu 2023-08-28 175325](https://github.com/microsoft/azure-pipelines-tasks/assets/3975111/f746db8b-5f84-403d-a70e-c55a0ada4596)


## Grant permissions

The Service Principal created needs to be given access to the target Azure scope e.g. an Azure Subscription.
This is done under Access Control (IAM).


## Federated Managed Identity

Instead of a Service Principal, you can also configure a Managed Identity, which also has Federated Identity blade.

![Zrzut ekranu 2023-08-28 182839](https://github.com/microsoft/azure-pipelines-tasks/assets/3975111/7338c10b-a5c2-4c7d-871a-c97ff0d1b1e5)



You can use Terraform to create a Service Connection with a Managed Identity. See [azuredevops_serviceendpoint_azurerm documentation](https://registry.terraform.io/providers/microsoft/azuredevops/latest/docs/resources/serviceendpoint_azurerm#workload-identity-federation-manual-azurerm-service-endpoint-subscription-scoped) and end-to-end sample at [Azure-Samples/azure-devops-terraform-oidc-ci-cd](https://github.com/Azure-Samples/azure-devops-terraform-oidc-ci-cd/tree/main).

