# Azure Resource Group Deployment Task

### Overview

This task is used to deploy Resource Groups in Azure using the [Azure Resource Manager templates](https://azure.microsoft.com/en-in/documentation/articles/resource-group-template-deploy/).

### The different parameters of the task are as described below:

- **Azure Subscription:** Select the Azure Subscription where the Resource Group will be deployed. This is a drop down of the subscriptions that have been added in the Services tab. See below Prerequisite section to know more about how to add Azure subscription through Services tab.

- **Resource Group, Location:** The name of the Resource Group and its location. If this is an existing Resource Group then the task will update the Resource Group with the Resources specified in the Azure template. If no Resource Group with the name exists in the Subscription then a new one will be created.
- **Template and its Parameters:** The templates and the templates parameters file are the Azure templates available at [GitHub](https://github.com/Azure/azure-quickstart-templates) or in the [Azure gallery](https://azure.microsoft.com/en-in/documentation/articles/powershell-azure-resource-manager/). To get started immediately use [this](http://aka.ms/sampletemplate) template that is available on GitHub. These files can be either checked in the Version Control of they can be part of the build itself. If the files are part of the Build, use the pre-defined [system variables](https://msdn.microsoft.com/Library/vs/alm/Build/scripts/variables) provided by the Build to specify their location. The variables to use are `$(Build.Repository.LocalPath)`, if the templates are checked-in but are not built, or `$(Agent.BuildDirectory)`, if the templates are built as part of the solution. Be sure to specify the full path like `$(Build.Repository.LocalPath)\Azure Templates\AzureRGDeploy.json`. Wildcards like `**\\*.json` or `**\*.param.json` are also supported and there needs to be only file that matches the search pattern at the location. If more than one file matches the search pattern then the task will error out.

	*NOTE: Follow the Azure Naming guidelines while specifying parameters, few important one mentioned in below table*  
	
	| Kind                 | Length | Casing           | Valid Chars                                                                           | Globally Unique |
	|----------------------|--------|------------------|---------------------------------------------------------------------------------------|-----------------|
	| Storage Account      | 3-24   | lowercase        | alphanumeric                                                                          | Yes             |
	| Azure Resource Group | 2-64   | case-insensitive | alphanumeric periods, underscores, hyphens and parenthesis and cannot end in a period | No              |
	| Azure KeyVault       | 3-24   | case-insensitive | alphanumeric                                                                          | Yes             |
	| Azure DNS Name       | 3-63   | lowercase        | alphanumeric and hyphens                                                              | Yes             |

- **Override Template Parameters:** The Override template parameters is used to override the parameters, like `–storageAccountName azurerg –adminUsername $(vmusername) –azureKeyVaultName $(fabrikamFibre)`.  
- **Advanced Deployment Options:** This section can be confusing if one does not understand the rationale behind the options. The following information will help in understanding the parameters and the proper use of them:

	- **Refresh SAS Token:** Azure provides in-built ability to deploy applications using Resource Extensions (RE) for PowerShell-DSC or Custom Script Extension for any of the scripting languages for Linux (Python, Shell scripts). The scripts and application files need to be available on an Azure storage account because the RE downloads them to the VMs and then runs them. The storage accounts are normally secured, and a Shared Access Signature (SAS) token is needed to access them. More information about the Azure SAS token is [here](https://azure.microsoft.com/en-us/documentation/articles/storage-dotnet-shared-access-signature-part-1/). This SAS token has an expiration date and the storage account cannot be accessed after the SAS token expires. This will break the Continuous Integration (Build) pipeline because the task will fail as it cannot access the storage account. The Refresh SAS token parameter refreshes the SAS token in the Azure template prior to sending it to Azure each time the Build is run. To do that it needs the name of the parameters for Azure Blob and SAS token as they have been specified in the Azure template parameters file. Multiple of these can be provided in Azure Blob Parameter and SAS Token Parameter by using the semi-colon delimiter like azurestore1; azurestore2; azurestore3. For example, the template parameters file has the following key-value pairs for Azure Storage account and SAS token. Then fill in azureStorage in the Azure Blob Parameter in the Azure Resource Deployment task and sasToken in the SAS Token Parameter. 
	 	
		`"azureStorage": {
		"value": "fabrikamfibre"
		},
		"sasToken": { 
		"value": " ?sv=2014-02-14&sr=c&sig=Dj1QOJups1%2Bf%2Beq989j%2FomowbmNS8Q2Qmf5eJEU9FGg%3D&st=2015-03-26T18%3A30%3A00Z&se=2015-04-03T18%3A30%3A00Z&sp=r"
		}`
	
		Note that Refresh SAS token is optional and only needed if deployment is being done to the Azure VMs using the Azure Resource Extension.

	- **Virtual Machine Credentials:** These are the Admin credentials for the Azure VMs that have been specified in the Azure template. The VM credentials are stored securely in the Deployment service, so that any subsequent tasks that need to access the VMs will not have to take this as an input. The tasks that need the credentials are Azure File Copy, PowerShell on Remote Machines, and Visual Studio Test Agent Deployment, so Virtual Machine Credentials must need to specified if you are using any of these tasks.

	- **Test Certificate:** The test certificate parameter requires background knowledge that is explained below. This parameter will be explained post the sections below.

- **Setting-up WinRM HTTPS on Azure VMs:** Tasks like Azure File Copy, PowerShell on Target Machines, Visual Studio Test Agent Deployment run on the Build Agent machine and copy files or deploy apps to Azure VMs using the WinRM HTTPS protocol. For these tasks to work properly the WinRM HTTPS port (default port is 5986) needs to be opened and configured properly on the VMs. Opening the ports and configuring them with the certificates is done using the Azure templates. The [sample template](http://aka.ms/sampletemplate) uploaded on GitHub shows how to enable the WinRM HTTPS port on Azure VMs and map them to a Public IP using the Azure resource provider’s wiz. Network Interfaces, Load Balancers and Virtual Machines. In addition, it also shows how to specify the Azure Key Vault and its secret, to download and install the certificate on the VM.

- **Azure Key Vault and Test Certificates:** [Azure Key Vault](https://azure.microsoft.com/en-us/documentation/articles/key-vault-get-started/) provides a secure way of storing certificates in Azure that can be easily downloaded and installed on the Azure VMs to enable WinRM HTTPS communication protocol. To create test certificates and to upload the certificates to Azure Key Vault follow the steps given below. Note that the Azure Key Vault can be in its own resource group and does not need to be in the resource group that is being dynamically created using the Azure Resource Group Deployment task. This way, once a certificate has been uploaded to the Azure Key Vault it can be reused across different Azure resource group deployments.
	- Run the following commands from the [developer command prompt](https://msdn.microsoft.com/en-us/library/ms229859.aspx) to create the test certificate. Replace the Common Name (CN) with the Resource Group name and the password with the real password.

		`makecert -sv armtest.pvk -n "cn=*.westus.cloudapp.azure.com" armtest.cer -b 06/06/2015 -e 06/06/2016 -r`

	 	`pvk2pfx -pvk armtest.pvk -spc armtest.cer -pfx armtest.pfx -po password`
	- For uploading the certificate to the Azure Key Vault follow the steps given below:
		- Download the [KeyVaultUrl.ps1](http://aka.ms/keyvaulturlscript) to the local disk.
		- Open Windows Azure Powershell
		- Change directory to where the KeyVaultUrl.ps1 file was copied to.
		- Run the following commands from Microsoft Azure Powershell *(Microsoft Azure powershell 0.9.0 or above version required to run the below command)*:
			- Add-AzureAccount
			- Select-AzureSubscription -SubscriptionName <`name`>
			- Switch-AzureMode AzureResourceManager
			- Import-Module .\KeyVaultUrl.ps1 –Force 
		- To generate the secret Id run the below command
			
			$a = Generate-KeyVaultUrl -resourceGroupName <resourceGroupName> -keyVaultName <KeyVaultName> -secretName <secretName> -location <location> -certificatePath <certPath> -password <password>
			
				Example:				
					$a = Generate-KeyVaultUrl -resourceGroupName fabrikamRG -keyVaultName fabrikamvalut -secretName fabrikam -location "West US" -certificatePath "D:\cert\ArmTest.pfx" -password password
			Secret Id will get printed as well as get stored in $a variable and it will be similar to – https://fabrikamvalut.vault.azure.net:443/secrets/fabrikam/256892c857714ec0bd76529147cf6b11

- **Test Certificate:** The Build Agent uses the [WinRM_HTTPS](https://support.microsoft.com/en-us/kb/2019527) communication protocol to deploy apps to the Azure VMs. For secure communication, certificates are used and they need to be installed on the VMs. For developing and testing apps, usually test certificates are used, and by checking-off the Test Certificate parameter, the trusted certificate authority (CA) validation is skipped. Note that the Common Name (CN) of the certificate has to be same as that of the Fully Qualified Domain Name (FQDN) of the VM. If the CN and FQDN different then the task will error out.


### Prerequisite for the task

##### Azure Subscription
To deploy to Azure, an Azure subscription has to be linked to VSO using the Services tab in the Account Administration section.

Add the Azure subscription to use in the Build tasks by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services tab. Select Azure from the Add New Service Connection dropdown. 

Fill in the required details from the Azure account, and select credentials for authentication as certificates are not supported by Azure Resource Manager. **The credentials have to be a work account because Microsoft accounts like [joe@live.com]() or [joe@hotmail.com]() are not supported.**     

*NOTE: Currently the Azure Resource Group Deployment Task will not work for the accounts having two factor authentication enabled, support will come soon.* 

##### Build Agent
A build agent has to be deployed on a machine to build the code and to run the tasks. The build agent is xcopy deployable, and does not need any installation. The agent can be deployed on machines behind the Firewall and also on Azure VMs. The build agent uses the HTTPS protocol to communicate with VSO and can work across proxies and firewalls. VSO also provides Hosted build agents that can be used to build code and to deploy the application. The Hosted build agents are made available on-demand and run on Azure.

Deploy the Windows build agent as per the instructions in the Build [docs](https://msdn.microsoft.com/Library/vs/alm/Build/agents/windows). The following are some of the issues that needs to be taken care of:


1.	Either use the default queue or create a new queue.
2.	Provide the rights to the account, under which the Build agent running, in VSO’s Control Panel named Agent Pools. The account that the build agent is running as should be added to the Agent Pool Service Accounts group.
3.	Download and configure the agent by following the instructions.    
4.	The tasks described in the blog need Azure PowerShell to be installed on the build agent, and that can be done easily using the [Web Platform Installer](https://www.microsoft.com/web/downloads/platform.aspx). Microsoft Azure powershell 0.9.0 or above version required for Azure Resource Group Deployment Task to work.