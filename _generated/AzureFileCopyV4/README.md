# Azure File Copy

### Overview

The task is used to copy application files and other artifacts that are required to install the application on Azure VMs like PowerShell scripts, PowerShell-DSC modules etc. The task provides the ability to copy files to an Azure blob or directly to Azure VMs. Even when the target is Azure VMs, Azure blobs are used as an intermediary and the files are copied to it first and then downloaded to the VMs. The tasks uses [AzCopy](https://azure.microsoft.com/en-in/documentation/articles/storage-use-azcopy/), the command-line utility built for fast copying of data from and into Azure storage accounts.

### Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

### Prerequisite for the task

**Azure Subscription**

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab. 

 - Use 'Azure Resource Manager' endpoint type to create a ARM endpoint, for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).
 -  As this version of task uses AzCopy 10, service principal needs to have one of these `Storage Blob Data Contributor` or `Storage Blob Data Owner` roles assigned to access resources. 
    1. Click on `Manage` link next to Azure Subscription
    2. Click `Manage Service Principal` which will redirect you to the Application Registration of the Service Principal. Copy the name.
    3. Go back and click `Manage service connection roles` which will redirect you to the IAM blade of the Azure Subscription. Here you need to assign a role to the service principal. Use name copied in previous step to search service principal  

**PowerShell**

The task needs at least version 3.0 of Powershell on the target machine.

**Azure PowerShell**

The task needs the Azure PowerShell version to be installed on the automation agent, and that can be done easily using the [Azure PowerShell Installer v1.0.2] (https://github.com/Azure/azure-powershell/releases/tag/v1.0.2-December2015). Refer to "Supported Azure and AzureRM module versions" section below for recommended versions.

**Azure Virtual Machines**

The task can copy files to the Azure Virtual Machines that are created either using the [new azure portal](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/). For copying the files to VMs, they are first copied to an automatically generated container in the  Azure storage account, and then from there to the VMs. The container is deleted after the files are copied successfully to the VMs.

To dynamically deploy Azure resource groups with virtual machines in them use the [Azure Resource Group Deployment](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/DeployAzureResourceGroup) task. The task has a sample template that can setup the WinRM HTTPS protocol on the virtual machines, open the 5986 port in the Firewall, and install the test certificate. After this the virtual machines are ready for use in the deployment task.

If the VMs have been created without opening the WinRM HTTPS ports then follow the steps below to setup the machine for WinRM HTTPS:

- In the target machine, the WinRM HTTPS port (default 5986) should be open in the Firewall. Disable [UAC remote restrictions](https://support.microsoft.com/en-us/kb/951016) and the credentials should be in the format of username like vmuser, where vmuser is the admin user of the VM.
- The trusted certificate should be installed in the Automation agent, and if the trusted certificate is not installed in the Automation agent, then ensure that the Test Certificate option is selected in the task for the application deployment to work.
- For more guidance refer this [blog](https://blogs.msdn.com/b/muthus_blog/archive/2015/11/04/pre-requisites-for-using-azure-vms-in-winrm-based-tasks-in-build-and-rm-workflows.aspx).

### Parameters of the task:

The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a * are required parameters for the task:

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
  
  * **Enable Copy Prerequisites**: Enabling this option configures Windows Remote Management (WinRM) listener over HTTPS protocol on port 5986, using a self-signed certificate. This configuration is required for performing copy operation on Azure machines. If the target Virtual Machines are backed by a Load balancer, ensure Inbound NAT rules are configured for target port (5986). If the target Virtual Machines are associated with a Network security group (NSG), configure Inbound security rules for Destination port (5986). Applicable only for ARM VMs.

  * **Copy in Parallel**: Selecting this option will copy files to all the VMs in the Resource Group in-parallel, hence speeding up the process of copying. 
  
  * **Clean Target**: Selecting this option will clean the destination folder prior to copying the files to it. 

  * **Test Certificate**: This setting is required while copying the files from the blob containers to the Azure VMs. The copy operation is initiated over the WinRM HTTPS protocol and if the VM has a test certificate installed on it, then select this option to  to skip the validation that the server certificate is signed by a trusted certificate authority (CA).  

* **Destination**: If the target is Azure blob then the following parameters need to be filled out. 

  * **Container Name**: The name of the container where the files will be copied to. If the container does not exist then a new one will be created with the name provided in this parameter. 

  * **Blob Prefix**: A prefix for the Blobs that can be used to filter the blobs like appending the Build number to the blobs, so that all the blobs with the same build number can be downloaded from the Container.

* **Additional Arguments**: Additional [AzCopy.exe](https://azure.microsoft.com/en-us/documentation/articles/storage-use-azcopy/) arguments that will be applied for uploading to blob and same will be applied for downloading while copy to VM.
  * **Blob Destination**: Supported additional arguments for copy to blob are /BlobType:, /Pattern:, /L, /Z, /XN, /A, /IA:, /XA:, /NC:, /DestType: and /SetContentType.
 
  * **VM Destination**: Supported additional parameters for copy to VM are /Pattern:, /L, /NC: and /XN.
 
### Output Variables

The task creates the following as output variables:
* **StorageContainerUri**: When copying files to an Azure container, this parameter returns the Uri of the container were the files were copied to.
* **StorageContainerSasToken**: When copying files to an Azure container, a SasToken is created and returned.  By default, this token expires after 4 hours.

Following the [output variables](https://docs.microsoft.com/en-us/azure/devops/pipelines/process/variables?view=azure-devops&tabs=yaml%2Cbatch#use-output-variables-from-tasks) documentation and naming the step, we can then reference the variables like so:

```yaml
- task: AzureFileCopy@4
  inputs:
    SourcePath: 'Readme.md'
    azureSubscription: 'Azure'
    Destination: 'AzureBlob'
    storage: 'storageAccount'
    ContainerName: 'containerName'
    BlobPrefix: ''
  name: AzureFileCopy
  
- script: | 
    echo $(AzureFileCopy.StorageContainerUri)
    echo $(AzureFileCopy.StorageContainerSasToken)
```

### Known Limitations :

* If resource group contains both [resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) and [classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) VMs, then copy operation will be performed only on resource manager VMs.
* To use Premium storage account, which only support Azure page blobs, please pass /BlobType:Page as additional arguments. 

### Earlier Versions

If you want to work with earlier version of this task, please refer README.md present at https://github.com/Microsoft/vsts-tasks/tree/releases/m94/Tasks/AzureFileCopy/. 

### Supported Azure and AzureRM module versions:
|  Azure Pipelines/TFS Release  |  Recommended Azure Version  
|:------------------:|:---------------------------:|
|  Azure Pipelines              |  [v1.3.2] (https://github.com/Azure/azure-powershell/releases/tag/v1.3.2-April2016)  |
|  TFS 2015 Update 3  | [v1.3.2] (https://github.com/Azure/azure-powershell/releases/tag/v1.3.2-April2016)  |
|  TFS 2015 Update 2  | [v1.0.2] (https://github.com/Azure/azure-powershell/releases/tag/v1.0.2-December2015)  |
