# Deploy Visual Studio Test Agent Task

### Overview
The Deploy Test agent task is used to Deploy the Test Agent to a set of machines. This Test Agent can then be used to enable data collection or run Distributed Tests using the ‘Run Functional Tests’ task.
To learn more about the general usage of the task, please see https://msdn.microsoft.com/en-us/library/mt270062.aspx and https://blogs.msdn.com/b/visualstudioalm/archive/2015/06/28/10618066.aspx

### Prerequisites
The task requires:
- .NET 4.6.1 on Windows7 or Windows 2K8R2
- PowerShell 3 or newer
- Test machines should have PSRemoting enabled (run 'Enable-PSRemoting' on Windows Powershell)
### WinRM setup
This task uses the [Windows Remote Management](https://msdn.microsoft.com/en-us/library/aa384426.aspx) (WinRM) to access domain-joined or workgroup, on-premises physical or virtual machines.

#### Windows Remote Management (WinRM) Setup for On-premises Physical or Virtual Machines
To easily **setup WinRM** on the **host machines** follow the directions for [domain-joined machines](https://www.visualstudio.com/en-us/docs/release/examples/other-servers/net-to-vm) or the [workgroup machines](https://www.visualstudio.com/en-us/docs/release/examples/other-servers/net-to-workgroup-vm).

#### Windows Remote Management (WinRM) Setup for Azure Virtual Machines
Azure virtual machines only work with the WinRM HTTPS protocol. With the WinRM protocol selected as HTTPS, you have an option to use the Test Certificate. Selecting the Test Certificate option means that the certificate is a self-signed certificate, and the automation agent will skip validating the authenticity of the machine's certificate from a trusted certification authority.

-	**Classic Virtual machines:** When creating [classic virtual machine](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) from the [new Azure portal](https://portal.azure.com/) or the [classic Azure portal](https://manage.windowsazure.com/), the virtual machine is already setup for WinRM HTTPS, with the default port 5986 already open in Firewall, and a self-signed certificate installed on the machine. These virtual machines can be directly added to the WinRM. The existing [classic virtual machine](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) can be also selected by using the [Azure Resource Group Deployment task](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup).

- **Azure Resource Group:** If an [Azure resource group](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-hero-tutorial/) has been created in the [new Azure portal](https://portal.azure.com/), then it needs to be setup for the WinRM HTTPS protocol (WinRM HTTPS, with the default port 5986 already open in Firewall, and a self-signed certificate installed on the machine).

To dynamically deploy Azure resource groups with virtual machines in them use the [Azure Resource Group Deployment task](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup). The task has a checkbox titled - **Enable Deployment Pre-requisites**. Select this option to setup the WinRM HTTPS protocol on the virtual machines, and to open the 5986 port in the Firewall, and to install the test certificate. After this the virtual machines are ready for use in the deployment task.

### The different parameters of the task are explained below:

#### Test machines
- **Machines:** Required Field. Provide the comma separated list of machine names or "Azure Resource Group" name or Variable name containing the list of machines on which the Test Agent should be deployed.

- **Admin login:** Username should be an admin on the Test Machines on which Test Agent is being deployed. Multiple formats like Domain\username, username, Machinename\username and .\username are supported. Note that UPN format like username@domain.com and built in System accounts like “NT Authority\System” are not supported

- **Admin password:** Password for the admin username. To encrypt your password, create a secret variable in the variables tab and use that variable here

- **Protocol:** Required Field in case of Flat Machines. Specify the protocol that should be used for communicating with machines where Test Agent should be deployed. By default, it uses HTTP protocol.

#### Agent configuration
- **Username:**	Required Field. Specify a username that the Test Agent will use. Username should be an admin on the Test Machines on which Test Agent is being deployed. Multiple formats like Domain\username, username, Machinename\username and .\username are supported. Note that UPN format like username@domain.com and built in System accounts like “NT Authority\System” are not supported

- **Password:**	Required Field. Password for the username given above. To encrypt your password, create a secret variable in the variables tab and use that variable here

- **Run UI tests:**	Check to indicate that the Test Agent should be configured to run as an interactive process. This is required when you run UI tests such as Coded UI or Selenium tests.

- **Enable data collection only:**	Checking this box will prevent tests from running on these set of machines. This is useful for scenarios where you only want to enable data collection from a set of machines. This is only valid for Code Coverage as of now.

  For example, in a client-server application model, you would use this option to deploy Test Agent on the server machines and use another deploy task to deploy Agent to test machines. This will enable you to collect data from both Server and client machines but will not use the test agent on server machines to run tests.

#### Advanced
- **Test agent version:** The version of Visual Studio test agent to use. Pick an appropriate version to match the VS version using which test binaries were built.

- **Test agent location:**	Optionally supply the path to test agent installer. This could be a network share or a local folder. If no path is provided, it will be automatically downloaded from the Download Center.
Installer for Test Agent 2015 Update 3 from https://go.microsoft.com/fwlink/?LinkId=827840.
Installer for Test Agent 2017 from https://aka.ms/vs/15/release/vs_TestAgent.exe

For example, if you have stored a local copy of the Test Agent within your network, you can specify a path to that. Specified location should be accessible by either buildagent (with the identity it is running with) OR testagent (with the identity its configured with above). For Azure test machines, web location can be provided.

- **Update test agent:**	If Test Agent is already deployed on a machine, this option checks to see if an update is available for that version of the Test Agent.


### Scenarios Supported
For a list of scenarios supported, please see https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/RunDistributedTests/README.md

### Configuring Test Machine Group / Azure Resource Group
Prerequisites for configuring Test machine group or Azure resource group to work with this task and other BDT tasks can be found at https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/PowerShellOnTargetMachines/README.md#machine-pre-requisites-for-the-task-
