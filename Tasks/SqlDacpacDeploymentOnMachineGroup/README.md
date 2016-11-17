# WinRM - SQL Server Database Deployment

## Overview:

The WinRM - SQL Server Database Deployment task is used to deploy SQL Server database to an existing SQL Server instance, and the underlying technologies used by the task are [DACPAC](https://msdn.microsoft.com/en-IN/library/ee210546.aspx) and [SqlPackage.exe](https://msdn.microsoft.com/en-us/library/hh550080\(v=vs.103\).aspx). DACPACs and SqlPackage.exe provide fine-grained control over database creation and upgrades, including upgrades for schema, triggers, stored procedures, roles, users, extended properties etc. Using the task, around eighty different properties can be set to ensure that the database is created or upgraded properly like:

- Ignore Data Loss - If false, upgrade will fail if it results in a data-loss.
- Verify Deployment - If true, the deployment is verified and blocked if can fail. For example, foreign keys have not been specified in the DACPAC but exist in the target database.
- Block on Changes - If true, upgrade is terminated if a schema drift is detected.
- Rollback on Failure - If true, then the upgrade is rolled back if errors are encountered.
- Backup Database Before Changes - If true, a backup of the database is taken prior to applying the changes.

The task runs on the automation agent machine, and connects to the target machine(s) using [Windows Remote Management][1] (WinRM), and launches a bootstrapping executable program (VisualStudioRemoteDeployer.exe) on the target machine(s), and the bootstrap executable invokes the PowerShell scripts to locate the sqlpackage.exe on the machine, and creates or updates the SQL Server database using sqlpackage.exe. As the execution happens within the target machine(s), it is important to have the pre-requisites described below, installed properly on the target machine(s).

## Contact Information

Please contact the alias RM\_Customer\_Queries at microsoft dot com, if you are facing problems in making this task work. Also, share feedback about the task, and the new features that you would like to see in it.

## Pre-requisites for the task

The following pre-requisites need to be setup in the target machine(s) for the task to work properly.

### SQL Server

There should be a SQL Server instance that is already installed and configured on the pre-existing machines or virtual machines. The task deploys SQL Server database but does not install or configure SQL Server.

### SqlPackage.exe

SqlPackage.exe is used to create or upgrade the database and it is installed during the installation of SQL Server 2008 R2/2012/2014/2016. If the SQL Server Database deployment task is targeting these versions of SQL Server, then there is no need to install SqlPackage.exe separately. However, the latest version of SqlPackage.exe ships with SQL Server 2014, and is also available as a web download, and installs when the products listed below are installed on a machine. The latest version of SqlPackage.exe can target database deployments from SQL Server 2005 onwards and it is advisable to install that on the deployment machine. If the deployment of the SQL Server database is happening on the Web Server which is targeting a database on a separate Database Server that is behind firewall in a DMZ zone, then SqlPackage.exe needs to be installed on the Web Server:

* Install the latest version of sqlpackage.exe by installing the **SQL Server Data-Tier Application Framework (July 2015)** from https://www.microsoft.com/en-us/download/details.aspx?id=48203. On x64 machines, install both the en\x86\DACFramework.msi and the en\x64\DACFramework.msi.
* Install it by using the [Microsoft Web Platform Installer](http://www.microsoft.com/web/gallery/install.aspx?appid=DACFX) (Web PI). Note that the link will open Web PI with the DACFX showing-up ready to install, where the DACFX download represents all the MSIs that need to be installed for SqlPackage.exe. **Note that this is an older version of June 2014 as compared to the link given above for the July 2015 release**.
* [SQL Server Management Studio](https://www.microsoft.com/en-in/download/details.aspx?id=42299) for SQL Server 2014 or SQL Server Express or SQL Server 2012 and SQL Server 2014 and [DAC Framework](http://www.microsoft.com/en-us/download/details.aspx?id=42293) MSIs install SqlPackage.exe at C:\Program Files (x86)\Microsoft SQL Server\120\DAC\bin. **Note that this is an older version as compared to the link given above for the July 2015 release**.
* Visual Studio 2015 installs the SqlPackage.exe at - C:\Program Files (x86)\Microsoft Visual Studio 14.0\Common7\IDE\Extensions\Microsoft\SQLDB\DAC\120. Here the install location of Visual Studio is - C:\Program Files (x86)\Microsoft Visual Studio 14.0. **Note that this is an older version as compared to the link given above for the July 2015 release**.

The task [PowerShell on Target Machines](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/PowerShellOnTargetMachines) can be used to deploy SqlPackage.exe to Azure virtual machines or domain-joined/workgroup machines.

### WinRM setup
This task uses the [Windows Remote Management](https://msdn.microsoft.com/en-us/library/aa384426.aspx) (WinRM) to access domain-joined or workgroup, on-premises physical or virtual machines.

#### Windows Remote Management (WinRM) Setup for On-premises Physical or Virtual Machines
**To easily setup WinRM on the host machines follow the directions** for [domain-joined machines](https://www.visualstudio.com/en-us/docs/release/examples/other-servers/net-to-vm) or the [workgroup machines](https://www.visualstudio.com/en-us/docs/release/examples/other-servers/net-to-workgroup-vm).

#### Windows Remote Management (WinRM) Setup for Azure Virtual Machines
Azure virtual machines only work with the WinRM HTTPS protocol. With the WinRM protocol selected as HTTPS, you have an option to use the Test Certificate. Selecting the Test Certificate option means that the certificate is a self-signed certificate, and the automation agent will skip validating the authenticity of the machine's certificate from a trusted certification authority.

 -	**Classic Virtual machines:** When creating [classic virtual machine](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) from the [new Azure portal](https://portal.azure.com/) or the [classic Azure portal](https://manage.windowsazure.com/), the virtual machine is already setup for WinRM HTTPS, with the default port 5986 already open in Firewall, and a self-signed certificate installed on the machine. These virtual machines can be directly added to the WinRM. The existing [classic virtual machine](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) can be also selected by using the [Azure Resource Group Deployment task](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup).

 - **Azure Resource Group:** If an [Azure resource group](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-hero-tutorial/) has been created in the [new Azure portal](https://portal.azure.com/), then it needs to be setup for the WinRM HTTPS protocol (WinRM HTTPS, with the default port 5986 already open in Firewall, and a self-signed certificate installed on the machine).

 To dynamically deploy Azure resource groups with virtual machines in them use the [Azure Resource Group Deployment task](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup). The task has a checkbox titled - **Enable Deployment Pre-requisites**. Select this option to setup the WinRM HTTPS protocol on the virtual machines, and to open the 5986 port in the Firewall, and to install the test certificate. After this the virtual machines are ready for use in the deployment task.

#### Specifying Machine Details in the Task

Specify the machine details, wiz. the IP Address or the FDQN, administrator's login, password, WimRM HTTP/HTTPS protocol, and Test Certificate in the task itself. The difference between using the domain-joined/workgroup on-premises physical or virtual machines and the Azure virtual machines is that copying files to them is done by separate tasks. The [Windows Machine File Copy](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/WindowsMachineFileCopy) is used for the domain-joined/workgroup machines and the [Azure File Copy](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/AzureFileCopy) is used for the Azure virtual machines. Note that the **WinRM - SQL Server Database Deployment** task expects the web application's package zip files to be available on the target machines or on a UNC path that is accessible by the target machine administrator's login.

## Parameters of the task:

The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a \* are required parameters for the task:

### Machine Details
This section of the task is used to provide the details of the machines to the task so that it can open a WinRM session with them and launch the bootstrap executable.

  - **Machines\*:** Specify comma separated list of machine FQDNs/IP addresses along with port(optional). For example dbserver.fabrikam.com, dbserver_int.fabrikam.com:5986,192.168.34:5986. Output variables from preceding tasks, like Azure Resource Group Deployment task, can be also provided here, e.g. $(Fabrikam). Port when not specified will be defaulted to WinRM defaults based on the specified protocol. i.e., (For *WinRM 2.0*):  The default HTTP port is 5985, and the default HTTPS port is 5986.
  - **Admin Login\*:** Domain or Local administrator of the target host. Format: &lt;Domain or hostname&gt;\&lt; Admin User&gt;, like fabrikam\markbrown.
  - **Password\*:**  Password for the admin login. It can accept variable defined in Build/Release definitions as '$(passwordVariable)'. The variable type should be marked as 'secret' to secure it.
  - **Protocol\*:**  Specify the protocol that will be used to connect to target host, either HTTP or HTTPS.
  - **Test Certificate:** Select the option to skip validating the authenticity of the machine's certificate by a trusted certification authority. The parameter is required for the WinRM HTTPS protocol.

### Deploy SQL Server Database
This section of the task is used to deploy SQL Server Database to an existing SQL Server using sqlpackage.exe.

  - **DACPAC File\*:** Location of the DACPAC file on the target machine or on a UNC path that is accessible to the administrator credentials of the machine like, \\BudgetIT\Web\Deploy\FabrikamDB.dacpac. Environment variables are also supported like $env:windir, $env:systemroot etc. For example, $env:windir\FabrikamFibre\Web.
  - **Specify SQL Using\*:** The task provides for three different ways to provide information to connect to a SQL Server instance. The options are to provide SQL Server instance and database details, or to provide a SQL Server connection string, or to provide the location of the Publish profile XML file on the target machine.
  - **Server Name\*:** Provide the SQL Server name like, _machinename_\FabriakmSQL,1433, or localhost, or .\SQL2012R2. Specifying localhost will connect to the Default SQL Server instance on the machine.
  - **Database Name\*:** The name of the SQL Server Database like Fabrikan. The Database will be created new if it does not exist, else it will be updated if it already exists.
  - **Authentication\*:** Select the authentication mode for connecting to the SQL Server. If the Windows authentication mode is selected, the administrator's account, as specified in the Machine Detail section, will be used to connect to the SQL Server. If the SQL Server Authentication mode is selected, then the SQL login and Password have to be provided in the parameters below.
  - **SQL Username** : Provide the SQL Server login. The option is required and only available if SQL Server Authentication mode is selected.
  - **SQL Password:** The password for the SQL Server login. The option is required and only available if SQL Server Authentication mode is selected.
  - **Connection String\*:** Specify the SQL Server connection string like "Server=localhost;Database=Fabrikam;User ID=sqluser;Password=password;".
  - **Publish Profile:** Publish profile provide fine-grained control over SQL Server database creation or upgrades. Specify the path to the Publish profile XML file on the target machine or on a UNC share that is accessible by the machine administrator's credentials. This is an optional parameter. However, if the seletced option for the 'Specify SQL Using' parameter is Publish Profile XML file, then this is a required parameter.
  - **Additional SqlPackage.exe Arguments:** Additional SqlPackage.exe arguments that will be applied when creating or updating the SQL Server database like:

  /p:IgnoreAnsiNulls=True /p:IgnoreComments=True

  These arguments will override the settings in the Publish profile XML file (if provided). A full list of the arguments that can provided is listed in the ' **Properties**' sub-section of the ' **Publish Parameters, Properties, and SQLCMD Variables**' in the [SqlPackage.exe](https://msdn.microsoft.com/en-us/library/hh550080\(v=vs.103\).aspx) documentation. The SQLCMD variables can be also specified here. This is an optional parameter.

### Advanced
The section provides for advanced options.
  - **Deploy in Parallel:** Selecting the option, will run the task, in-parallel on the target machines.

## Known Issues

- The SQL Server Database Deployment task does not support BACPAC and SQL scripts. The SqlPackage.exe provides out-of-box support for both BACPAC and SQL Scripts and the work to enable this support is in our backlog. Please send us feedback for the task and for the support for BACPAC and SQL scripts at RM\_Customer\_Queries at microsoft dot com.   

  [1]: https://msdn.microsoft.com/en-us/library/aa384426(v=vs.85).aspx
