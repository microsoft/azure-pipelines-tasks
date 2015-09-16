# SQL Server Database Deployment

## Overview:

The task is used to deploy SQL Server database to an existing SQL Server instance, and the underlying technologies used by the task are [DACPAC](https://msdn.microsoft.com/en-IN/library/ee210546.aspx) and [SqlPackage.exe](https://msdn.microsoft.com/en-us/library/hh550080\(v=vs.103\).aspx). DACPACs and SqlPackage.exe provide fine-grained control over database creation and upgrades, including upgrades for schema, triggers, stored procedures, roles, users, extended properties etc. Using the task, around eighty different properties can be set to ensure that the database is created or upgraded properly like:

- Ignore Data Loss - If false, upgrade will fail if it results in a data-loss.
- Verify Deployment - If true, the deployment is verified and blocked if can fail. For example, foreign keys have not been specified in the DACPAC but exist in the target database.
- Block on Changes - If true, upgrade is terminated if a schema drift is detected.
- Rollback on Failure - If true, then the upgrade is rolled back if errors are encountered. 
- Backup Database Before Changes - If true, a backup of the database is taken prior to applying the changes.

The task runs on the target machine(s) and it is important to have the pre-requisites, as described below, installed on the machine(s). The flow is that the automation agent when executing the task, connects to the target machine using the Windows Remote Management (WinRM), and then launches a bootstrap service, which in turn invokes the PowerShell scripts to locate the SqlPackage.exe on the machine, and deploys the database using the SqlPackage.exe.

## Contact Information

Please contact the alias RM\_Customer\_Queries at microsoft dot com, if you are facing problems in making this task work. Also, if you would like to share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, then do send an email to the alias.

## Pre-requisites for the task

The following pre-requisites need to be setup for the task to work properly.

### SqlPackage.exe

SqlPackage.exe is used to create or upgrade the database and it is installed during the installation of SQL Server 2008 R2/2012/2014. If the SQL Server Database deployment task is targeting these versions of SQL Server, then there is no need to install SqlPackage.exe separately. However, the latest version of SqlPackage.exe ships with SQL Server 2014, and is also available as a web download, and installs when the products listed below are installed on a machine. The latest version of SqlPackage.exe can target database deployments from SQL Server 2005 onwards and it is advisable to install that on the deployment machine. If the deployment of the SQL Server database is happening on the Web Server which is targeting a database on a separate Database Server that is behind firewall in a DMZ zone, then SqlPackage.exe needs to be installed on the Web Server:

* Install it by using the [Microsoft Web Platform Installer](http://www.microsoft.com/web/gallery/install.aspx?appid=DACFX) (Web PI). Note that the link will open Web PI with the DACFX showing-up ready to install, where the DACFX download represents all the MSIs that need to be installed for SqlPackage.exe.
* [SQL Server Management Studio](https://www.microsoft.com/en-in/download/details.aspx?id=42299) for SQL Server 2014 or SQL Server Express or SQL Server 2012 and SQL Server 2014 and [DAC Framework](http://www.microsoft.com/en-us/download/details.aspx?id=42293) MSIs install SqlPackage.exe at C:\Program Files (x86)\Microsoft SQL Server\120\DAC\bin.
* Visual Studio 2015 installs the SqlPackage.exe at - C:\Program Files (x86)\Microsoft Visual Studio 14.0\Common7\IDE\Extensions\Microsoft\SQLDB\DAC\120. Here the install location of Visual Studio is - C:\Program Files (x86)\Microsoft Visual Studio 14.0.

The task [PowerShell on Target Machines](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/PowerShellOnTargetMachines) can be used to deploy SqlPackage.exe to Azure virtual machines or domain-joined/workgroup machines.

### SQL Server

There should be a SQL Server instance that is already installed and configured on the pre-existing machines or virtual machines. The task deploys SQL Server database but does not install or configure SQL Server.

### Pre-existing Machine Groups

If the deployment of the database is on pre-existing machines (physical or virtual machines) then a machine group has to be created in the Machines Hub. There is a manage link next to the Machine Group parameter of the task. Click on the link to navigate to the Machines Hub and create a machine group. Note that the IP Address or the FDQN of Azure virtual machines can be also added in the machine group. The difference between using the domain-joined/workgroup machines and the Azure virtual machines is that copying files to them uses separate tasks wiz. [Windows Machine File Copy](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/WindowsMachineFileCopy) for the domain-joined/workgroup machines and [Azure File Copy](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/AzureFileCopy) for the Azure virtual machines. Note that the SQL Server Database Deployment task expects the DACPACs to be available on the machines or on a UNC path that is accessible by the machine administrator's login. Prior to using the SQL Server Database Deployment task, ensure that the DACPACs are available for the deployment by copying them to the machines using the Windows Machine File Copy or the Azure File Copy tasks.

### Azure Resource Groups

To use dynamically deployed Azure virtual machines, use the [Azure Resource Group Deployment](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup) task to deploy the virtual machines in a Resource Group and then the name of the Resource Group can be typed in the Machine Group parameter of the SQL Server Database Deployment task. As described above, copy the DACPACs to the virtual machines in the Azure Resource Group using the [Azure File Copy](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/AzureFileCopy) task.

_NOTE: Currently existing Azure Resource Groups, classic (v1) or Azure Resource Manager (v2), cannot be used in the Build or Release Management definitions. Ability to select existing Resource Groups and to use the virtual machine resources in them to deploy applications to is coming soon._

### Windows Remote Management (WinRM) Setup

The SQL Server Database Deployment task uses the [Windows Remote Management](https://msdn.microsoft.com/en-us/library/aa384426(v=vs.85).aspx) (WinRM) to access domain-joined/workgroup machines or Azure virtual machines. WinRM is Microsoft's implementation of  [WS-Management Protocol](https://msdn.microsoft.com/en-us/library/aa384470(v=vs.85).aspx) that is firewall-friendly and provides a common way for systems to access and exchange management information across on-premises or Cloud IT infrastructure. The automation agent that runs the SQL Server Database Deployment task uses WinRM to communicate with the target machines. It is important to setup WinRM properly on the target machines else the deployment tasks will fail. The configuration of WinRM is described in detail on the MSDN [site](https://msdn.microsoft.com/en-us/library/aa384372(v=vs.85).aspx). For the target machines the following will ensure that the WinRM has been setup properly on them:

1. Azure virtual machines only work with the WinRM HTTPS protocol. When creating [classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) or [resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) virtual machine from the Azure preview portal or Azure portal, the virtual machine is already setup for WinRM HTTPS, with the default port 5986 already open in Firewall, and a test certificate installed on the machine. These virtual machines can be directly added to a machine group, with the WinRM protocol selected as HTTPS, and the Skip CA Check option selected. The Skip CA Check means that the certificate is a test certificate and the client should skip the validation of the certificate by a trusted certification authority.                  
2. To dynamically deploy Azure resource groups with virtual machines in them use the [Azure Resource Group Deployment](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup) task. The task has a sample template that can setup the WinRM HTTPS protocol on the virtual machines, open the 5986 port in the Firewall, and install the test certificate. After this the virtual machines are ready for use in the SQL Server Database Deployment task.
3. For pre-existing on-premises machines, domain-joined or workgroup, and whether they are physical machines or virtual machines, set them up as per the table below to ensure that the deployment tasks work fine with them:

<table border="1" style="width:100%">
<tr>
	<th> Target Machine State </th>
	<th> Target Machine Trust with Automation Agent </th>
	<th> Machine Identity </th>
	<th> Authentication Account </th>
	<th> Authentication Mode </th>
	<th> Authentication Account Permission on Target Machine </th>
	<th> Connection Type </th>
	<th> Pre-requisites in Target machine for Deployment Tasks to Succeed </th>
</tr>
<tr>
	<td> Domain joined machine in Corp network </td>
	<td> Trusted </td>
	<td> DNS name </td>
	<td> Domain account </td>
	<td> Kerberos </td>
	<td> Machine Administrator </td>
	<td> WinRM HTTP </td>
	<td>	<ul>
		<li> WinRM HTTP port (default 5985) opened in Firewall. </li>
		<li> File & Printer sharing enabled </li>
		</ul> </td>
</tr>
<tr>
	<td> Domain joined machine in Corp network </td>
	<td> Trusted </td>
	<td> DNS name </td>
	<td> Domain account </td>
	<td> Kerberos </td>
	<td> Machine Administrator </td>
	<td> WinRM HTTPS </td>
	<td>	<ul>
		<li> WinRM HTTPS port (default 5986) opened in Firewall. </li>
		<li> Trusted certificate in Automation agent. </li>
		<li> If Trusted certificate not in Automation agent, then Test Certificate option enabled in Task for deployment. </li>
		<li> File & Printer sharing enabled. </li>
		</ul> </td>
</tr>
<tr>
	<td> Domain joined machine or Workgroup machine, in Corp network </td>
	<td> Any </td>
	<td> DNS name </td>
	<td> Local machine account </td>
	<td> NTLM </td>
	<td> Machine Administrator </td>
	<td> WinRM HTTP </td>
	<td>	<ul>
		<li> WinRM HTTP port (default 5985) opened in Firewall. </li>
		<li> Disable UAC remote restrictions (<a href="https://support.microsoft.com/en-us/kb/951016">link</a>). </li>
		<li> Credential in <Account> format. </li>
		<li> Set "AllowUnencrypted" option and add remote machines in "Trusted Host" list in Automation Agent (<a href="https://msdn.microsoft.com/en-us/library/aa384372(v=vs.85).aspx">link</a>). </li>
		<li> File & Printer sharing enabled. </li>
		</ul> </td>
</tr>
<tr>
	<td> Domain joined machine or Workgroup machine, in Corp network </td>
	<td> Any </td>
	<td> DNS name </td>
	<td> Local machine account </td>
	<td> NTLM </td>
	<td> Machine Administrator </td>
	<td> WinRM HTTPS </td>
	<td>	<ul>
		<li> WinRM HTTPS port (default 5986) opened in Firewall. </li>
		<li> Disable UAC remote restrictions(<a href="https://support.microsoft.com/en-us/kb/951016">link</a>). </li>
		<li> Credential in <Account> format. </li>
		<li> Trusted certificate in Automation agent. </li>
		<li> If Trusted certificate not in Automation agent, then Test Certificate option enabled in Task for deployment. </li>
		<li> File & Printer sharing enabled. </li>
		</ul> </td>
</tr>
</table>

## Parameters of the task:

The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a \* are required parameters for the task:

- **Machine Group\*:** The task runs in the target machine to deploy the SQL Server database. For this purpose, a target machine group has to be selected in this parameter. The dropdown will populate the pre-existing machine groups that have been created in the Machines Hub. To create a new machine group, or to edit/delete an existing one, click on the Manage link next to the machine group parameter. The link will open the Machines hub in a new tab. To use Azure virtual machines that have been created using the [Azure Resource Group Deployment](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup) task, manually type-in the name of the Resource Group in this parameter.
- **Select Machines by:** The optional parameter is used to specify a subset of machine(s) in the machine group, where the task will run. The subset of machines can be specified using machine names or tags. The machine where the task will run should be able to connect to the SQL Server instance on the port 1433, or any other port where the SQL Server has been configured to listen to.
- **Deploy to Machines:** The optional parameter is used to specify the machines where the task will run. Either a list of machine names can be provided like, dbserver.fabrikam.com, webserver.fabrikam.com, 192.168.12.34, or tags can be provided like, Role:DB; OS:Win8.1. If multiple tags are provided, then the task will run in all the machines with the specified tags. For Azure Resource Groups, provide the virtual machine's name like, ffweb, ffdb. . The virtual machine's name is it's host name and not the DNS name or the IP address. The default is to run the task in all machines of the machine group or the resource group.
- **DACPAC File\*:** Location of the DACPAC file on the target machine or on a UNC path that is accessible to the administrator credentials of the machine like, \\BudgetIT\Web\Deploy\FabrikamDB.dacpac. Environment variables are also supported like $env:windir, $env:systemroot etc. For example, $env:windir\FabrikamFibre\Web.
- **Specify SQL Using\*:** The task provides for three different ways to provide information to connect to a SQL Server instance. The options are to provide SQL Server instance and database details, or to provide a SQL Server connection string, or to provide the location of the Publish profile XML file on the target machine.
- **Server Name\*:** Provide the SQL Server name like, _machinename_\FabriakmSQL,1433, or localhost, or .\SQL2012R2. Specifying localhost will connect to the Default SQL Server instance on the machine.
- **Database Name\*:** The name of the SQL Server Database like Fabrikan. The Database will be created new if it does not exist, else it will be updated if it already exists.
- **SQL Username** : Optionally provide the SQL Server login, and if provided, it will be used to connect to the SQL Server. The default is to use the Integrated Authentication and the machine administrator credentials are used to connect to the SQL Server instance.
- **SQL Password:** The password for the SQL Server login. Required parameter if the SQL username is specified.   
- **Connection String\*:** Specify the SQL Server connection string like "Server=localhost;Database=Fabrikam;User ID=sqluser;Password=password;".
- **Publish Profile:** Publish profile provide fine-grained control over SQL Server database creation or upgrades. Specify the path to the Publish profile XML file on the target machine or on a UNC share that is accessible by the machine administrator's credentials. This is an optional parameter.
- **Additional SqlPackage.exe Arguments:** Additional SqlPackage.exe arguments that will be applied when creating or updating the SQL Server database like:

 /p:IgnoreAnsiNulls=True /p:IgnoreComments=True

These arguments will override the settings in the Publish profile XML file (if provided). A full list of the arguments that can provided is listed in the ' **Properties**' sub-section of the ' **Publish Parameters, Properties, and SQLCMD Variables**' in the [SqlPackage.exe](https://msdn.microsoft.com/en-us/library/hh550080\(v=vs.103\).aspx) documentation. The SQLCMD variables can be also specified here. This is an optional parameter.

- **Deploy in Parallel:** Setting it to true will run the database deployment task in-parallel on the target machines.

## Known Issues

- The SQL Server Database Deployment task does not support BACPAC and SQL scripts. The SqlPackage.exe provides out-of-box support for both BACPAC and SQL Scripts and the work to enable this support is in our backlog. Please send us feedback for the task and for the support for BACPAC and SQL scripts at RM\_Customer\_Queries at microsoft dot com.   