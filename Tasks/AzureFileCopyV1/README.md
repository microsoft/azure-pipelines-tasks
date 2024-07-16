# Azure File Copy

### Overview

The task is used to copy application files and other artifacts that are required to install the application on Azure VMs like PowerShell scripts, PowerShell-DSC modules etc. The task provides the ability to copy files to an Azure blob or directly to Azure VMs. Even when the target is Azure VMs, Azure blobs are used as an intermediary and the files are copied to it first and then downloaded to the VMs. The tasks uses [AzCopy](https://azure.microsoft.com/en-in/documentation/articles/storage-use-azcopy/), the command-line utility built for fast copying of data from and into Azure storage accounts.

### Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

### Prerequisite for the task

**Azure Subscription**

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.

 - For Azure Classic resources use 'Azure' endpoint type with Certificate or Credentials based authentication. If you are using credentials based auth, ensure that the credentials are for a [**work account**](https://azure.microsoft.com/en-in/pricing/member-offers/msdn-benefits-details/work-accounts-faq/) because Microsoft accounts like [**joe@live.com**](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/DeployAzureResourceGroup) or [**joe@hotmail.com**](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/DeployAzureResourceGroup) are not supported.

 - For [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/), use 'Azure Resource Manager' endpoint type, for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

 - If you are using 'Azure' endpoint type with Certificate based authentication or 'Azure Resource Manager' endpoint type, the task automatically filters appropriate [classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) storage account and the newer [resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) storage accounts and other fields viz. Resource Group/Cloud Service & Virtual Machines.

 - *Note*: If you use a Credentials-based 'Azure' endpoint we don't automatically populate the **Storage** & **Resource Group/Cloud Service** fields for you yet. You will need to manually enter values for now. With Certificate-based endpoints we query Azure and populate these dropdowns for you.

The following table lists the storage accounts and the service connections that with them. To identify whether a storage account is based on the classic APIs or the resource manager APIs, log into [https://portal.azure.com/](https://portal.azure.com/) and browse for storage accounts (classic) or storage accounts.

| **Storage Account Type** | **Azure Service Connections in TFS/Azure Pipelines** |
| --- | --- |
| [Resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) |      Azure Resource Manager EndPoint  |
| [Classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) |      Azure EndPoint type with Certificate or credentials based authentication on work accounts |

For Azure MSDN accounts, in addition to the certificates and the Service Principal, a work account can be easily created as shown below:

1. Create an user in the Azure Active Directory from the [portal](https://msdn.microsoft.com/en-us/library/azure/hh967632.aspx) (this is the old Azure portal). After adding the account, the following two things need to be done to use the organization in Azure Pipelines:
  - Add the Active Directory account to the co-administrators in the subscription. Go to the Settings and then click on administrators and add the account as a co-admin like, [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com)
  - Login to the portal with this Active Directory account wiz. [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com), and change the password. Initially a temporary password is created and that needs to be changed at the first login.
2. Add that user and password in the service connections in the Azure Pipelines and deployments will work with that account.

**PowerShell**

The task needs at least version 3.0 of Powershell on the target machine.


**Azure PowerShell**

The task needs the Azure PowerShell version to be installed on the automation agent, and that can be done easily using the [Azure PowerShell Installer v1.0.2] (https://github.com/Azure/azure-powershell/releases/tag/v1.0.2-December2015). Refer to "Supported Azure and AzureRM module versions" section below for recommended versions.

**Azure Virtual Machines**

The task can copy files to the Azure Virtual Machines that are created either using the [new azure portal](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) or through the [azure classic portal](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/). For copying the files to VMs, they are first copied to an automatically generated container in the  Azure storage account, and then from there to the VMs. The container is deleted after the files are copied successfully to the VMs. The valid combination of Azure service connections and storage accounts for copying to an Azure is as given below:

| **Storage Account Type** | **Azure Service Connections in TFS/Azure Pipelines** | **Azure Virtual Machines** |
| --- | --- | --- |
| [Resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) | Azure Resource Manager Endpoint | [Resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) Azure Virtual machines |
| [Classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) | Azure Endpoint type with Certificate or credentials based authentication on work accounts | [Classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) Azure Virtual machines |
When copying the files from the blob container to the Azure VMs, Windows Remote Management (WinRM) HTTPS protocol is used. This requires that the WinRM HTTPS service is properly setup on the VMs and a certificate is also installed on the VMs.

To dynamically deploy Azure resource groups with virtual machines in them use the [Azure Resource Group Deployment](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzureResourceGroupDeploymentV2) task. The task has a sample template that can setup the WinRM HTTPS protocol on the virtual machines, open the 5986 port in the Firewall, and install the test certificate. After this the virtual machines are ready for use in the deployment task.

If the VMs have been created without opening the WinRM HTTPS ports then follow the steps below to setup the machine for WinRM HTTPS:

- In the target machine, the WinRM HTTPS port (default 5986) should be open in the Firewall. Disable [UAC remote restrictions](https://support.microsoft.com/en-us/kb/951016) and the credentials should be in the format of username like vmuser, where vmuser is the admin user of the VM.
- The trusted certificate should be installed in the Automation agent, and if the trusted certificate is not installed in the Automation agent, then ensure that the Test Certificate option is selected in the task for the application deployment to work.
- For more guidance refer this [blog](https://blogs.msdn.com/b/muthus_blog/archive/2015/11/04/pre-requisites-for-using-azure-vms-in-winrm-based-tasks-in-build-and-rm-workflows.aspx).

### Parameters of the task:

The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a * are required parameters for the task:

* **Azure Connection Type**: Specify Azure endpoint type, for Azure Classic resources use 'Azure' endpoint, for Azure ARM resources use 'Azure Resource Manager' endpoint.

* **Azure Subscription**: The name of Azure subscription, where the Azure storage account is located. The storage account is accessed using the stored credentials of the Azure account in the Services tab.

* **Source**: The source of the files. As described above using pre-defined system variables like $(Build.Repository.LocalPath) make it easy to specify the location of the build on the Build Automation Agent machine. The variables resolve to the working folder on the agent machine, when the task is run on it. Note that wild cards like *\.zip are not supported.

* **Storage Account**: The name of an existing storage account in the Azure Subscription specified earlier.

* **Destination**: The target for copying the files and is either an Azure blob or VMs. The section below details the parameters that need to be filled-out if the target is Azure VMs.

 * **Resource Group**: Name of the resource group that contains the Azure VMs.

 * **Select Machines By**: The parameter is used to copy the files to a subset of VMs and the subset can be specified by the host name of the VMs or the tags on them. [Tags](https://learn.microsoft.com/en-us/azure/virtual-machines/tag-template/) are supported for resources created via the Azure Resource Manager only.

 * **Filter Criteria**: If you are copying to a subset of VMs using machine names filter, you can provide a comma separated list of the VM host names for example, ffweb, ffdb1, ffdb2. If you are using tags then you can specify tags in the format “<Key1>:<Value1>, <Key2>:<Value2>” for example, role:web, db; OS:win7. The default behavior is to copy to all the VMs in the Resource Group. Note the delimiters used for tags are &#44;(comma), &#58;(colon) and &#59;(semicolon).

 * **Admin Login**: Administrator Username for all the Azure VMs in the Resource Group.

 * **Password**: Administrator Username password for all the Azure VMs in the Resource Group.

 * **Destination Folder**: The folder in the Azure VMs where the files will be copied to. Environment variables are also supported like $env:windir, $env:systemroot etc. An example of the destination folder is $env:windir\FabrikamFibre\Web or c:\FabrikamFibre.

 * **Clean Target**: Selecting this option will clean the destination folder prior to copying the files to it.

 * **Copy in Parallel**: Selecting this option will copy files to all the VMs in the Resource Group in-parallel, hence speeding up the process of copying.

 * **Test Certificate**: This setting is required while copying the files from the blob containers to the Azure VMs. The copy operation is initiated over the WinRM HTTPS protocol and if the VM has a test certificate installed on it, then select this option to  to skip the validation that the server certificate is signed by a trusted certificate authority (CA).

* **Destination**: If the target is Azure blob then the following parameters need to be filled out.

 * **Container Name**: The name of the container where the files will be copied to. If the container does not exist then a new one will be created with the name provided in this parameter.

 * **Blob Prefix**: A prefix for the Blobs that can be used to filter the blobs like appending the Build number to the blobs, so that all the blobs with the same build number can be downloaded from the Container.

* **Additional Arguments**: Additional [AzCopy.exe](https://azure.microsoft.com/en-us/documentation/articles/storage-use-azcopy/) arguments that will be applied for uploading to blob and same will be applied for downloading while copy to VM.
* **Blob Destination**: Supported additional arguments for copy to blob are /BlobType:, /Pattern:, /L, /Z, /XN, /A, /IA:, /XA:, /NC:, /DestType: and /SetContentType.

 * **VM Destination**: Supported additional parameters for copy to VM are /Pattern:, /L, /NC: and /XN.

* **Output Parameters**
 * **Storage Container Uri**: When copying files to an Azure container, if you want the task to return the Uri of the container where the files were copied to, provide the name of the output variable you would like to use.

 * **Storage Container SasToken**: When copying files to an Azure container, if you want the task to create and return a SasToken for the container, provide the name of the output variable you would like to use.  By default, this token expires after 4 hours.

* **Enable Copy Prerequisites**: Enabling this option configures Windows Remote Management (WinRM) listener over HTTPS protocol on port 5986, using a self-signed certificate. This configuration is required for performing copy operation on Azure machines. If the target Virtual Machines are backed by a Load balancer, ensure Inbound NAT rules are configured for target port (5986). If the target Virtual Machines are associated with a Network security group (NSG), configure Inbound security rules for Destination port (5986). Applicable only for ARM VMs.

### Known Limitations :

* If resource group contains both [resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) and [classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) VMs, then based on connection type copy operation will be performed on either resource manager or classic VMs. For Cert-based connection and Cred-based connection copy operation will be performed only on classic VMs and for SPN-based connection copy operation will be performed only on resource manager VMs.
* To use Premium storage account, which only support Azure page blobs, please pass /BlobType:Page as additional arguments.

### Earlier Versions

If you want to work with earlier version of this task, please refer README.cmd present at https://github.com/Microsoft/azure-pipelines-tasks/tree/releases/m94/Tasks/AzureFileCopy/.

### Supported Azure and AzureRM module versions:
|  Azure Pipelines/TFS Release  |  Recommended Azure Version  |  Other Supported Versions |
|:------------------:|:---------------------------:|:-------------------------:|
|  Azure Pipelines              |  [v1.3.2] (https://github.com/Azure/azure-powershell/releases/tag/v1.3.2-April2016)  |  [v0.9.8] (https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |
|  TFS 2015 Update 3  | [v1.3.2] (https://github.com/Azure/azure-powershell/releases/tag/v1.3.2-April2016)  |  [v0.9.8] (https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |
|  TFS 2015 Update 2  | [v1.0.2] (https://github.com/Azure/azure-powershell/releases/tag/v1.0.2-December2015)  |  [v0.9.8] (https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |
|  TFS 2015 Update 1  | [v0.9.8] (https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |  |
|  TFS 2015 RTM       | [v0.9.8] (https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |  |
