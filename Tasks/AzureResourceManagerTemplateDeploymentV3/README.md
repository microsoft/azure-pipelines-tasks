# Azure Resource Manager (ARM) Template Deployment Task

### Overview

This task is used to deploy [Azure Resource Manager templates](https://azure.microsoft.com/en-in/documentation/articles/resource-group-template-deploy/) at resource group deployment scope, subscription deployment scope and management group [deployment scopes](https://docs.microsoft.com/bs-latn-ba/Azure/azure-resource-manager/resource-group-template-deploy-rest#deployment-scope). The task is also used to create or update a resource group in Azure.

### What's new in Version 3.0
 - Added support for Subscription and Management Group deployment scopes.
 - Removed all the VM related actions.


### Contact Information
Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.


### Prerequisite for the task

#### Azure Subscription

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab. Create a service endpoint of 'Azure Resource Manager' type. For more troubleshooting guidance around endpoint creation, refer [this](https://www.visualstudio.com/en-us/docs/build/actions/azure-rm-endpoint).

For Azure MSDN accounts, one can either use a [Service Principal](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409) or a work account. It's easy to create a work account as shown below:

1. Create an user in the Azure Active Directory from the [portal](https://msdn.microsoft.com/en-us/library/azure/hh967632.aspx) (this is the old Azure portal). After adding the account, the following two things need to be done to use the organization in Azure Pipelines:
  - Add the Active Directory account to the co-administrators in the subscription. Go to the Settings and then click on administrators and add the account as a co-admin like, [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com)
  - Login to the portal with this Active Directory account wiz. [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com), and change the password. Initially a temporary password is created and that needs to be changed at the first login.
2. Add that user and password in the service connections in Azure Pipelines and deployments will work with that account.

#### Azure PowerShell

The task needs the Azure PowerShell version to be installed on the automation agent, and that can be done easily using the [Azure PowerShell Installer v1.0.2](https://github.com/Azure/azure-powershell/releases/tag/v1.0.2-December2015). Refer to "Supported Azure and AzureRM module versions" section below for recommended versions.

### Parameters of the task:

The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a \* are required parameters for the task:

 * **Deployment Scope**\*: Select the scope of deployment from the options: Resource Group, Subscription and Mangement Group. For more info refer this [link](https://docs.microsoft.com/bs-latn-ba/Azure/azure-resource-manager/resource-group-template-deploy-rest#deployment-scope)

 * **Azure Resource Manager connection**\*: Select the ARM service connection with appropriate access i.e. the ARM service connection should have access to the resource group, subscription or the management group where the ARM template is targetted. To configure new service connection, select the Azure subscription from the list and click 'Authorize'. If your subscription is not listed or if you want to use an existing Service Principal, you can setup an Azure service connection using 'Manage' link.

 * **Subscription**\*: Select the subscripton to which the deployment is targetted.

 * **Action**\*: If the deployment scope is 'Resource Group', select the action to be performed on the resource group. Following actions are available:
    - Create or Update Resource Group: creates a new resource group or to update an existing one (using [Azure Resource Manager templates](https://azure.microsoft.com/en-in/documentation/articles/resource-group-template-deploy/)).
    - Delete Resource Group
    - Select Resource Group( not supported here - use Version 2.0 for this action ): reads the Resource Group information from Azure and creates an Output Variable with the VMs in the Resource Group
    - Start, Stop, Deallocate, Restart, Delete Virtual Machines( not supported here - use Version 2.0 for this action  )

 * **Resource Group**\*: Enter the name of the resource group. If this is an existing resource group, and the selected action is to create or update the resource group, then the task will update the resource group with the resources specified in the Azure template. If no Resource Group with the name exists in the subscription, then a new one will be created.

 * **Location**\*:
     - For Resource Group deployment scope: Location for deploying the resource group. If the resource group already exists in the subscription, then this value will be ignored.
    - For other deployment scopes: Location for storing the deployment metadata.

 * **Template location**: The location of the Template & the Parameters JSON files. Select "Linked Artifact" if the files are part of the linked code/build artifacts. For "Linked Artifacts", you can also specify the path to a Bicep file.  Select "URL of the file" if the JSON files are located at any publicly accessible http/https URLs. To use a file stored in a private storage account, retrieve and include the shared access signature (SAS) token in the URL of the template. Example: <blob_storage_url>/template.json?<SAStoken>. To upload a parameters file to a storage account and generate a SAS token, you could use [Azure file copy task](https://aka.ms/azurefilecopyreadme) or follow the steps using [PowerShell](https://go.microsoft.com/fwlink/?linkid=838080) or [Azure CLI](https://go.microsoft.com/fwlink/?linkid=836911).

 * **Template and its Parameters**: The templates and the templates parameters file are the Azure templates available at [GitHub](https://github.com/Azure/azure-quickstart-templates) or in the [Azure gallery](https://azure.microsoft.com/en-in/documentation/articles/powershell-azure-resource-manager/). To get started immediately use [this](https://aka.ms/sampletemplate) template that is available on GitHub.
	- These files can be either be located at any publicly accessible http/https URLs or be in a checked in the Version Control or they can be part of the build itself. If the files are part of the Build, use the pre-defined [system variables](https://msdn.microsoft.com/Library/vs/alm/Build/scripts/variables) provided by the Build to specify their location. The variables to use are $(Build.Repository.LocalPath), if the templates are checked-in but are not built, or $(Agent.BuildDirectory), if the templates are built as part of the solution. Be sure to specify the full path like $(Build.Repository.LocalPath)\Azure Templates\AzureRGDeploy.json. Wildcards like \*\*\\\*.json or \*\*\\*.param.json are also supported and there needs to be only one file that matches the search pattern at the location. If more than one file matches the search pattern, then the task will error out.

 **NOTE**: Follow the Azure Naming guidelines while specifying parameters, few important one mentioned in below table_

|         Kind         | Length | Casing           | Valid Chars                                                                           | Globally Unique |
|:--------------------:|--------|------------------|---------------------------------------------------------------------------------------|:---------------:|
| Storage Account      | 3-24   | lowercase        | alphanumeric                                                                          | Yes             |
| Azure Resource Group | 2-64   | case-insensitive | alphanumeric periods, underscores, hyphens and parenthesis and cannot end in a period | No              |
| Azure KeyVault       | 3-24   | case-insensitive | alphanumeric                                                                          | Yes             |
| Azure DNS Name       | 3-63   | lowercase        | alphanumeric and hyphens                                                              | Yes             |

 * **Override Template Parameters**: The Override template parameters is used to override the parameters, like `-storageAcctName azurerg -Username $(vmusername) -azureKeyVaultName $(fabrikamFibre)`. To avoid storing "secureString" parameters in plain text, it is recommended that you use secret variables, for example `$(variableName)`. By clicking on “…” next to Override template parameters textbox, template parameters can be viewed/overridden in a grid.  This feature requires that CORS rules are enabled at the source. If templates are in Azure storage blob, refer to [this](https://docs.microsoft.com/en-us/rest/api/storageservices/fileservices/Cross-Origin-Resource-Sharing--CORS--Support-for-the-Azure-Storage-Services?redirectedfrom=MSDN#understanding-cors-requests) to enable CORS.

 * **Deployment Mode**: This specifies the [deployment mode](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-deploy) in which the Azure resources specified in the template have to be deployed. Incremental mode handles deployments as incremental updates to the resource group . It leaves unchanged resources that exist in the resource group but are not specified in the template. Complete mode deletes resources that are not in your template. [Validate mode](https://msdn.microsoft.com/en-us/library/azure/dn790547.aspx) enables you to find syntactical problems with the template before creating actual resources. By default, incremental mode is used.

 ### Deployment Outputs:
  Outputs created by Azure Resource Manager template deployment. It can be used in the subsequent tasks (like Powershell and Azure CLI) for further processing.

 **How to use Deployment output**
  The deployment output can be parsed to JSON object using "ConvertFrom-Json" Powershell cmdlet in Powershell/Azure Powershell task and then that object can be used in same task or subsequent tasks.

  Example:
  ```
  $var=ConvertFrom-Json '$(storageAccountName)'
  $value=$var.storageAccountName.value
  Write-Host "##vso[task.setvariable variable=storageAccount;]$value"
  ```

  On linux agent, same technique can be used to create a JSON object. However, if you want to avoid Powershell task, you can use a script similar to below which converts the Outputs to valid JSON by adding double quotes.

  ```
  var=`echo "$(storageAccountName)" | \
  sed -e 's/ //g' | \
  sed -e 's/}/"\n}/g' | \
  sed -e 's/{/{\n"/g' | \
  sed -e 's/:/":"/g'  | \
  sed -e 's/,/",\n"/g' | \
  sed -e 's/"}/}/g' | \
  sed -e 's/}"/}/g'  | \
  sed -e 's/"{/{/g'  | \
  sed -e 's/\[/\[\n"/g' | \
  sed -e 's/]/"\n]/g' | \
  sed -e 's/"\[/\[/g' | \
  sed -e 's/]"/]/g'`
  sa_name=`echo $var | jq -r .storageAccountName.value`
  echo $sa_name
  ```

### Supported Azure and AzureRM module versions:
|  Azure Pipelines/TFS Release  |  Recommended Azure Version  |  Other Supported Versions |
|:------------------:|:---------------------------:|:-------------------------:|
|  Azure Pipelines              |  [v1.3.2](https://github.com/Azure/azure-powershell/releases/tag/v1.3.2-April2016)  |  [v0.9.8](https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |
|  TFS 2015 Update 3  | [v1.3.2](https://github.com/Azure/azure-powershell/releases/tag/v1.3.2-April2016)  |  [v0.9.8](https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |
|  TFS 2015 Update 2  | [v1.0.2](https://github.com/Azure/azure-powershell/releases/tag/v1.0.2-December2015)  |  [v0.9.8](https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |
|  TFS 2015 Update 1  | [v0.9.8](https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |  |
|  TFS 2015 RTM       | [v0.9.8](https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |  |
	
### Limitations:

- Does not support multiline strings in arm template/parameter json file.
