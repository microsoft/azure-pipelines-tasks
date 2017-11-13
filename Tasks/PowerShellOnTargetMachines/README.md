# PowerShell on Target Machines 

### Overview
The task is used run PowerShell on the target machines. The task can run both PowerShell scripts and PowerShell-DSC scripts. For PowerShell scripts, PowerShell 2.0 is needed on the machines and for PowerShell-DSC scripts [Windows Management Framework 4.0](https://www.microsoft.com/en-in/download/details.aspx?id=40855&40ddd5bd-f9e7-49a6-3526-f86656931a02=True) needs to be installed on the machines. WMF 4.0 ships in-the-box in Windows 8.1 and Windows Server 2012 R2.

### WinRM setup
This task uses the [Windows Remote Management](https://msdn.microsoft.com/en-us/library/aa384426.aspx) (WinRM) to access domain-joined or workgroup, on-premises physical or virtual machines.

#### Windows Remote Management (WinRM) Setup for On-premises Physical or Virtual Machines
To easily **setup WinRM** on the **host machines** follow the directions for [domain-joined machines](https://www.visualstudio.com/en-us/docs/release/examples/other-servers/net-to-vm) or the [workgroup machines](https://www.visualstudio.com/en-us/docs/release/examples/other-servers/net-to-workgroup-vm).

#### Windows Remote Management (WinRM) Setup for Azure Virtual Machines
Azure virtual machines only work with the WinRM HTTPS protocol. With the WinRM protocol selected as HTTPS, you have an option to use the Test Certificate. Selecting the Test Certificate option means that the certificate is a self-signed certificate, and the automation agent will skip validating the authenticity of the machine's certificate from a trusted certification authority.

- **Classic Virtual machines:** When creating [classic virtual machine](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) from the [new Azure portal](https://portal.azure.com/) or the [classic Azure portal](https://manage.windowsazure.com/), the virtual machine is already setup for WinRM HTTPS, with the default port 5986 already open in Firewall, and a self-signed certificate installed on the machine. These virtual machines can be directly added to the WinRM. The existing [classic virtual machine](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) can be also selected by using the [Azure Resource Group Deployment task](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup).

- **Azure Resource Group:** If an [Azure resource group](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-hero-tutorial/) has been created in the [new Azure portal](https://portal.azure.com/), then it needs to be setup for the WinRM HTTPS protocol (WinRM HTTPS, with the default port 5986 already open in Firewall, and a self-signed certificate installed on the machine).

To dynamically deploy Azure resource groups with virtual machines in them use the [Azure Resource Group Deployment task](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup). The task has a checkbox titled - **Enable Deployment Pre-requisites**. Select this option to setup the WinRM HTTPS protocol on the virtual machines, and to open the 5986 port in the Firewall, and to install the test certificate. After this the virtual machines are ready for use in the deployment task.

### The different parameters of the task are explained below: 

 * **Machines**: Specify comma separated list of machine FQDNs/ip addresses along with port(optional). For example dbserver.fabrikam.com, dbserver_int.fabrikam.com:5986,192.168.34:5986. Port when not specified will be defaulted to WinRM defaults based on the specified protocol. i.e., (For *WinRM 2.0*):  The default HTTP port is 5985, and the default HTTPS port is 5986. 
 * **Admin Login**: Domain/Local administrator of the target host. Format: &lt;Domain or hostname&gt;\ &lt; Admin User&gt;. 
 * **Password**:  Password for the admin login. It can accept variable defined in Build/Release definitions as '$(passwordVariable)'. You may mark variable type as 'secret' to secure it. 
 * **Protocol**:  Specify the protocol that will be used to connect to target host, either HTTP or HTTPS.
 * **Test Certificate**: Select the option to skip validating the authenticity of the machine's certificate by a trusted certification authority. The parameter is required for the WinRM HTTPS protocol. 
* **PowerShell Script**: The location of the PowerShell script on the target machine like c:\FabrikamFibre\Web\deploy.ps1. Environment variables can be also used like $env:windir, $env:systemroot etc. 
* **Script Arguments**: The arguments needed by the script, if any provided in the following format -applicationPath $(applicationPath) -username $(vmusername) -password $(vmpassword). 
* **Initialization Script**: The location of the data script that is used by PowerShell-DSC and the location has to be on the target machine. It is advisable to use arguments in place of the initialization script.  
* **Session Variables**: Used for setting-up the session variables for the PowerShell scripts and the input is a comma separated list like $varx=valuex, $vary=valuey. This is mostly used for backward compatibility with the earlier versions of Release Management product and it is advisable to use arguments in place of the session variables.
* **Advanced Options**: The advanced options provide more fine-grained control on the deployment. 
* **Run PowerShell in Parallel**: Checking this option will execute the PowerShell in-parallel on all the target machines.  
      
### Known Issues :

Write-Host command is not supported in PowerShell script.
