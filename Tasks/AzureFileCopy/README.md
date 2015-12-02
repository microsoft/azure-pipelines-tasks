#Azure File Copy

### Overview

The task is used to copy application files and other artifacts that are required to install the application on Azure VMs like PowerShell scripts, PowerShell-DSC modules etc. The task provides the ability to copy files to an Azure blob or directly to Azure VMs. Even when the target is Azure VMs, Azure blobs are used as an intermediary and the files are copied to it first and then downloaded to the VMs. The tasks uses [AzCopy](https://azure.microsoft.com/en-in/documentation/articles/storage-use-azcopy/), the command-line utility built for fast copying of data from and into Azure storage accounts.

### Contact Information

Please contact the alias RM\_Customer\_Queries at microsoft dot com, if you are facing problems in using this task work. Also, if you would like to share feedback about the task like, what more functionality should be added to the task, and what other tasks you would like to have, then do send an email to the alias.

### Prerequisite for the task

**Azure Subscription**

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Visual Studio Online using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab. Select Azure from the Add New Service Connection dropdown. Fill in the required details from the Azure account, and select credentials, or certificate, or service principal for authentication. The credentials have to be a [**work account**](https://azure.microsoft.com/en-in/pricing/member-offers/msdn-benefits-details/work-accounts-faq/) because Microsoft accounts like [**joe@live.com**](https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/DeployAzureResourceGroup) or [**joe@hotmail.com**](https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/DeployAzureResourceGroup) are not supported. For using Service Principal, follow the steps listed in the link [here](http://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

The task supports both the [classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) storage account and the newer [resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) storage account. The classic and the resource manager APIs support different authentication type, and depending upon the storage account the Azure connect has to be appropriately setup in Visual Studio Online (VSO) or Team Foundation Server (TFS). The following table lists the storage accounts and the service connections that with them. To identify whether a storage account is based on the classic APIs or the resource manager APIs, log into [https://portal.azure.com/](https://portal.azure.com/) and browse for storage accounts (classic) or storage accounts.

| **Storage Account Type** | **Azure Service Connections in VSO/TFS** |
| --- | --- |
| [Resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) | Service principal or credentials based on work accounts |
| [Classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) | Certificate or credentials based on work accounts |

For Azure MSDN accounts, in addition to the certificates and the Service Principal, a work account can be easily created as shown below:

1. Create an user in the Azure Active Directory from the [portal](https://msdn.microsoft.com/en-us/library/azure/hh967632.aspx) (this is the old Azure portal). After adding the account, the following two things need to be done to use the account in VSO:
  - Add the Active Directory account to the co-administrators in the subscription. Go to the Settings and then click on administrators and add the account as a co-admin like, [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com)
  - Login to the portal with this Active Directory account wiz. [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com), and change the password. Initially a temporary password is created and that needs to be changed at the first login.
2. Add that user and password in the service connections in the VSO and deployments will work with that account.

**Azure PowerShell**

The task needs the Azure PowerShell version 0.9.8.1 (released on 13th Oct 2015) or a later version to be installed on the automation agent, and that can be done easily using the [Web Platform Installer](https://www.microsoft.com/web/downloads/platform.aspx).

**Azure Virtual Machines**

The task can only copy files to the Azure Virtual Machines that are created using the [resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) APIs or through the [new Azure portal](https://portal.azure.com/). For copying the files to VMs, they are first copied to an automatically generated container in the  Azure storage account, and then from there to the VMs. The container is deleted after the files are copied successfully to the VMs. The valid combination of Azure service connections and storage accounts for copying to a Azure is as given below:

| **Storage Account Type** | **Azure Service Connections in VSO/TFS** | **Azure Virtual Machines** |
| --- | --- | --- |
| [Resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) | Service principal or credentials based on work accounts | The Azure Virtual machines created using the Resource Manager APIs |

When copying the files from the blob container to the Azure VMs, Windows Remote Management (WinRM) HTTPS protocol is used. This requires that the WinRM HTTPS service is properly setup on the VMs and a certificate is also installed on the VMs.

To dynamically deploy Azure resource groups with virtual machines in them use the [Azure Resource Group Deployment](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup) task. The task has a sample template that can setup the WinRM HTTPS protocol on the virtual machines, open the 5986 port in the Firewall, and install the test certificate. After this the virtual machines are ready for use in the deployment task.

If the VMs have been created without opening the WinRM HTTPS ports then follow the steps below to setup the machine for WinRM HTTPS:

- In the target machine, the WinRM HTTPS port (default 5986) should be open in the Firewall. Disable [UAC remote restrictions](https://support.microsoft.com/en-us/kb/951016) and the credentials should be in the format of username like vmuser, where vmuser is the admin user of the VM.
- The trusted certificate should be installed in the Automation agent, and if the trusted certificate is not installed in the Automation agent, then ensure that the Test Certificate option is selected in the task for the application deployment to work.
- For more guidance refer this [blog](http://blogs.msdn.com/b/muthus_blog/archive/2015/11/04/pre-requisites-for-using-azure-vms-in-winrm-based-tasks-in-build-and-rm-workflows.aspx).

### Parameters of the task:

The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a * are required parameters for the task:

* **Azure Subscription**: The name of Azure subscription, where the Azure storage account is located. The storage account is accessed using the stored credentials of the Azure account in the Services tab. 

* **Source**: The source of the files. As described above using pre-defined system variables like $(Build.Repository.LocalPath) make it easy to specify the location of the build on the Build Automation Agent machine. The variables resolve to the working folder on the agent machine, when the task is run on it. Note that wild cards like *\.zip are not supported. 

* **Storage Account**: The name of an existing storage account in the Azure Subscription specified earlier. 

* **Destination**: The target for copying the files and is either an Azure blob or VMs. The section below details the parameters that need to be filled-out if the target is Azure VMs. 

 * **Resource Group**: Name of the resource group that contains the Azure VMs. 

 * **Admin Login**: Administrator Username for all the Azure VMs in the Resource Group.

 * **Password**: Administrator Username password for all the Azure VMs in the Resource Group.

 * **Destination Folder**: The folder in the Azure VMs where the files will be copied to. Environment variables are also supported like $env:windir, $env:systemroot etc. An example of the destination folder is $env:windir\FabrikamFibre\Web or c:\FabrikamFibre. 

 * **Clean Target**: Selecting this option will clean the destination folder prior to copying the files to it. 

 * **Copy in Parallel**: Selecting this option will copy files to all the VMs in the Resource Group in-parallel, hence speeding up the process of copying. 

 * **Test Certificate**: This setting is required while copying the files from the blob containers to the Azure VMs. The copy operation is initiated over the WinRM HTTPS protocol and if the VM has a test certificate installed on it, then select this option to  to skip the validation that the server certificate is signed by a trusted certificate authority (CA).  

* **Destination**: If the target is Azure blob then the following parameters need to be filled out. 

 * **Container Name**: The name of the container where the files will be copied to. If the container does not exist then a new one will be created with the name provided in this parameter. 

 * **Blob Prefix**: A prefix for the Blobs that can be used to filter the blobs like appending the Build number to the blobs, so that all the blobs with the same build number can be downloaded from the Container.

* **Additional Arguments**: Additional [AzCopy.exe](https://azure.microsoft.com/en-us/documentation/articles/storage-use-azcopy/) arguments that will be applied when uploading to blob or uploading to VM like, /MT. We use "/S", "/Y" and "/Z" as default parameters.

### Known Issues :

The task can only copy files to the Azure Virtual Machines that are created using the resource manager APIs or through the new Azure portal. The copy to Azure VMs does not work with VMs created using the classic APIs.

### Earlier Versions

If you want to work with earlier version of this task, please refer README.cmd present at https://github.com/Microsoft/vso-agent-tasks/tree/releases/m90/Tasks/AzureFileCopy/. 

### Supported Azure and AzureRM module versions:
* Azure module version: [0.9.10](http://www.powershellgallery.com/packages/Azure/0.9.10)
* AzureRM module version: [1.0.0](http://www.powershellgallery.com/packages/AzureRM/1.0.0)
 
