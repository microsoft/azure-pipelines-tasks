#Azure File Copy

### Overview

The task is used to copy application files and other artifacts that are required to install the application on Azure VMs like PowerShell scripts, PowerShell-DSC modules etc. The task provides the ability to copy files to an Azure blob or directly to Azure VMs. Even when the target is Azure VMs, Azure blobs are used as an intermediary and the files are copied to it first and then downloaded to the VMs. The tasks uses [AzCopy](https://azure.microsoft.com/en-in/documentation/articles/storage-use-azcopy/), the command-line utility built for fast copying of data from and into Azure storage accounts.

###The different parameters of the task are explained below:

* **Azure Subscription**: The name of Azure subscription, where the Azure storage account is located. The storage account is accessed using the stored credentials of the Azure account in the Services tab. 

* **Source**: The source of the files. As described above using pre-defined system variables like $(Build.Repository.LocalPath) make it easy to specify the location of the build on the Build Automation Agent machine. The variables resolve to the working folder on the agent machine, when the task is run on it. Wild cards like **\*.zip are not supported. 

* **Storage Account**: The name of an existing storage account in the Azure Subscription specified earlier. 

* **Destination**: The target for copying the files and is either an Azure blob or VMs. The section below details the parameters that need to be filled-out if the target is Azure VMs. Note that for copying the files to VMs, they are first copied to an automatically generated container in the Azure storage account, and then from there to the VMs. The container is deleted after the files are copied successfully to the VMs. 

 * **Resource Group**: Name of the resource group that contains the Azure VMs. 

 * **Select Machines By**: The parameter is used to copy the files to a subset of VMs and the subset can be specified by the names of the machines or the tags on them.   
 * **Filter Criteria**: If copying to a subset of machines provide a comma separated list of the VMs here, else if using tags then provide the tags in the format Role:Web; OS:win7. The default is to copy to all the VMs in the Resource Group. 

 * **Destination Folder**: The folder in the Azure VMs where the files will be copied to. Environment variables are also supported like $env:windir, $env:systemroot etc. An example of the destination folder is $env:windir\FabrikamFibre\Web. 

 * **Clean Target**: Checking this option will clean the destination folder prior to copying the files to it. 

 * **Copy Files in Parallel**: Checking this option will copy files to all the VMs in the Resource Group in-parallel, hence speeding up the process of copying. 

* **Destination**: If the target is Azure blob then the following parameters need to be filled out. 

 * **Container Name**: The name of the container where the files will be copied to. If the container does not exist then a new one will be created with the name provided in this parameter.  

 * **Blob Prefix**: A prefix for the Blobs that can be used to filter the blobs like appending the Build number to the blobs, so that all the blobs with the same build number can be downloaded from the Container.
 
### Machine Pre-requisites for the Task :


| S.NO | Target Machine State                                       | Target Machine trust with Automation agent | Machine Identity | Authentication Account | Authentication Mode | Authentication Account permission on Target Machine | Connection Type | Pre-requisites in Target machine for Copy Task to succeed                                                                                                                                                                                                                                                                                                                                                                                                                    |
|------|------------------------------------------------------------|--------------------------------------------|------------------|------------------------|---------------------|-----------------------------------------------------|-----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1    | Workgroup machine in Azure                                 | Un Trusted                                 | DNS name         | Local machine account  | NTLM                | Machine Administrator                               | WinRM HTTP      | <ul><li>WinRM HTTP port (default 5985) opened in Firewall.</li><li>Disable UAC remote restrictions<a href="https://support.microsoft.com/en-us/kb/951016">(link)</a></li><li>Credential in <MachineName>\<Account> format.</li><li>Set "AllowUnencrypted" option and add remote machines in "Trusted Host" list in Automation Agent <a href="https://msdn.microsoft.com/en-us/library/aa384372(v=vs.85).aspx">(link)</a></li></ul>                                           |
| 2    | Workgroup machine in Azure                                 | Un Trusted                                 | DNS name         | Local machine account  | NTLM                | Machine Administrator                               | WinRM HTTPS     | <ul><li>WinRM HTTPS port  (default 5986) opened in Firewall.</li><li>Disable UAC remote restrictions<a href="https://support.microsoft.com/en-us/kb/951016">(link)</a></li><li>Credential in <MachineName>\<Account> format.</li><li>Trusted certificate in Automation agent.</li><li>If Trusted certificate not in Automation agent then Test Certificate option enabled in Task for deployment.</li></ul>                                                                  |
| 3    | Any                                                        | Any                                        | IP address       | Any                    | NTLM                | Machine Administrator                               | WinRM HTTP      | <ul><li>WinRM HTTP port (default 5985) opened in Firewall.</li><li>Disable UAC remote restrictions <a href="https://support.microsoft.com/en-us/kb/951016">(link)</a></li><li>Credential in <MachineName>\<Account> format</li><li>Set "AllowUnencrypted" option and add remote machines in "Trusted Host" list in Automation Agent <a href="https://msdn.microsoft.com/en-us/library/aa384372(v=vs.85).aspx">(link)</a></li><li>File & Printer sharing enabled</li></ul>    |
| 4    | Any                                                        | Any                                        | IP address       | Any                    | NTLM                | Machine Administrator                               | WinRM HTTPS     | <ul><li>WinRM HTTPS port  (default 5986) opened in Firewall.</li><li>Disable UAC remote restrictions<a href="https://support.microsoft.com/en-us/kb/951016">(link)</a></li><li>Credential in <MachineName>\<Account> format.</li><li>Trusted certificate in Automation agent.</li><li>If Trusted certificate not in Automation agent then Test Certificate option enabled in Task for deployment.</li><li>File & Printer sharing enabled.</li></ul>                          |
