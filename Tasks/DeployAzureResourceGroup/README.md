# Azure Resource Group Deployment Task

### Overview

This task is used to create or update a resource group in Azure using the [Azure Resource Manager templates](https://azure.microsoft.com/en-in/documentation/articles/resource-group-template-deploy/). The task is also used to start, stop, restart and delete virtual machines in a Resource Group, or to delete a resource group, including all the resources within the resource group.

### Contact Information

Please contact the alias RM\_Customer\_Queries at microsoft dot com, if you are facing problems in making this task work. Also, if you would like to share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, then do send an email to the alias.

### Prerequisite for the task

##### Azure Subscription

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Visual Studio Online using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab. Select Azure from the Add New Service Connection dropdown. Fill in the required details from the Azure account, and select credentials or service principal for authentication. The credentials have to be a [**work account**](https://azure.microsoft.com/en-in/pricing/member-offers/msdn-benefits-details/work-accounts-faq/) because Microsoft accounts like [**joe@live.com**](https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/DeployAzureResourceGroup) or [**joe@hotmail.com**](https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/DeployAzureResourceGroup) are not supported. For Service Principal, follow the steps listed [here](http://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

Note that this tasks creates or updates a resource group using [resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) APIs. The actions like starting, stopping, restarting, or deleting resource groups only work on VMs that have been created using the [resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) APIs. These tasks do not work with the VMs that have been created using the [classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) APIs, e.g. in the [old Azure](https://manage,windowsazure.com/) portal.

For Azure MSDN accounts, one can either use a [Service Principal](http://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409) or a work account. It's easy to create a work account as shown below:

1. Create an user in the Azure Active Directory from the [portal](https://msdn.microsoft.com/en-us/library/azure/hh967632.aspx) (this is the old Azure portal). After adding the account, the following two things need to be done to use the account in VSO:
  - Add the Active Directory account to the co-administrators in the subscription. Go to the Settings and then click on administrators and add the account as a co-admin like, [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com)
  - Login to the portal with this Active Directory account wiz. [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com), and change the password. Initially a temporary password is created and that needs to be changed at the first login.
2. Add that user and password in the service connections in the VSO and deployments will work with that account.

##### Azure PowerShell

The task needs the Azure PowerShell version 0.9.0 or later to be installed on the automation agent, and that can be done easily using the [Web Platform Installer](https://www.microsoft.com/web/downloads/platform.aspx). Ensure that the Azure PowerShell is installed in the default PSModulePath, that is "C:\Program Files\WindowsPowerShell\Modules" for Azure PowerShell version 1.0.0 or later and in "C:\Program Files\Microsoft SDKs\Azure\PowerShell" for other Azure PowerShell versions.

### Parameters of the task:

### The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a \* are required parameters for the task:

 * **Azure Subscription**: Select the Azure Subscription where the Resource Group will be created/updated, or where the resource group is located for starting/stopping/restarting/deleting virtual machines in it, or for deleting the resource group. This is a drop down of the Azure service connections that have been added in the Services tab and only shows the connections that have been created using the Service Principal or the credentials.
 * **Action**: Select the action to be performed on the resource group. The options are to create a new resource group or to update an existing one (using [Azure Resource Manager templates](https://azure.microsoft.com/en-in/documentation/articles/resource-group-template-deploy/)). Other actions are to start, restart, stop, or delete virtual machines in a resource group, or to delete a resource group and all resources in it.
 * **Resource Group**: Enter the name of the resource group. If this is an existing resource group, and the selected action is to create or update the resource group, then the task will update the resource group with the resources specified in the Azure template. If no Resource Group with the name exists in the subscription, then a new one will be created.

The following parameters are shown when the selected action is to create or update a resource group:

 * **Location**: The location where the resource group will be created. If an existing resource group is updated, then this parameter will be ignored.
 * **Template and its Parameters**: The templates and the templates parameters file are the Azure templates available at [GitHub](https://github.com/Azure/azure-quickstart-templates) or in the [Azure gallery](https://azure.microsoft.com/en-in/documentation/articles/powershell-azure-resource-manager/). To get started immediately use [this](http://aka.ms/sampletemplate) template that is available on GitHub. These files can be either checked in the Version Control of they can be part of the build itself. If the files are part of the Build, use the pre-defined [system variables](https://msdn.microsoft.com/Library/vs/alm/Build/scripts/variables) provided by the Build to specify their location. The variables to use are $(Build.Repository.LocalPath), if the templates are checked-in but are not built, or $(Agent.BuildDirectory), if the templates are built as part of the solution. Be sure to specify the full path like $(Build.Repository.LocalPath)\Azure Templates\AzureRGDeploy.json. Wildcards like \*\*\\\*.json or \*\*\\*.param.json are also supported and there needs to be only one file that matches the search pattern at the location. If more than one file matches the search pattern, then the task will error out.

 *NOTE: Follow the Azure Naming guidelines while specifying parameters, few important one mentioned in below table_

	| Kind                 | Length | Casing           | Valid Chars                                                                           | Globally Unique |
	|----------------------|--------|------------------|---------------------------------------------------------------------------------------|-----------------|
	| Storage Account      | 3-24   | lowercase        | alphanumeric                                                                          | Yes             |
	| Azure Resource Group | 2-64   | case-insensitive | alphanumeric periods, underscores, hyphens and parenthesis and cannot end in a period | No              |
	| Azure KeyVault       | 3-24   | case-insensitive | alphanumeric                                                                          | Yes             |
	| Azure DNS Name       | 3-63   | lowercase        | alphanumeric and hyphens                                                              | Yes             |

 * **Override Template Parameters**: The Override template parameters is used to override the parameters, like -storageAcctName azurerg -Username $(vmusername) -azureKeyVaultName $(fabrikamFibre).

### Output variables:
 Create/update action of the Azure Resource Group task now produces an output variable during execution. The output variable can be used to refer to the resource group object in the subsequent tasks. For example "PowerShell on Target Machine" task can now refer to resource group output variable as '$(variableName)' so that it can execute the powershell script on the resource group VM targets. 
 
 Limitation: Output variable produced during execution will have details about VM hostname(s) and (public) ports, if any. Credentials to connect to the VM host(s) are to be provided explicitly in the subsequent tasks.


### Setting up a virtual machine for WinRM HTTPS using Azure Templates:

Tasks like Azure File Copy, PowerShell on Target Machines, Visual Studio Test Agent Deployment run on the automation agent machine and copy files or deploy apps to Azure VMs using the WinRM HTTPS protocol. For these tasks to work properly, the WinRM HTTPS port (default port is 5986) needs to be opened and configured properly on the virtual machines. Opening the ports and configuring them with the certificates is done using the Azure templates. The [sample template](http://aka.ms/sampletemplate) uploaded on GitHub shows how to enable the WinRM HTTPS protocol on Azure virtual machines and map them to a Public IP using the Azure resource providers' wiz. Network Interfaces, Load Balancers and Virtual Machines. In addition, it also shows how to specify the Azure Key Vault and its secret, and to download and install the certificate on the virtual machine.

### Supported Azure and AzureRM module versions:
 Azure module version: [0.9.10](http://www.powershellgallery.com/packages/Azure/0.9.10)
 AzureRM module version: [1.0.0](http://www.powershellgallery.com/packages/AzureRM/1.0.0)
 
