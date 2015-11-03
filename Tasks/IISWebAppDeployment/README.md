# IIS Web Application Deployment

## Overview

The task is used to deploy a web application or a website to IIS web server and to create or update websites and application pools, and the underlying technologies used by the task is [Web Deploy](http://www.iis.net/downloads/microsoft/web-deploy) and [AppCmd.exe](http://www.iis.net/learn/get-started/getting-started-with-iis/getting-started-with-appcmdexe). Web Deploy packages the web application content, configuration and any other artifacts like registry, GAC assemblies etc. that can be used deployment. If the package needs to be redeployed to a different environment, configuration values within the package can be parameterized during deployment without requiring modifications to the packages themselves. Web deploy works with IIS 7, IIS 7.5, IIS 8, and IIS 8.5. AppCmd.exe is the single command line tool for managing IIS 7 and above. It exposes all key server management functionality through a set of intuitive management objects that can be manipulated from the command line or from scripts.

The task runs on the target machine(s) and it is important to have the pre-requisites, as described below, installed on the machine(s). The flow is that the automation agent when executing the task, connects to the target machine using the Windows Remote Management (WinRM), and then launches a bootstrap service, which in turn invokes the PowerShell scripts to locate the msdeploy.exe on the machine, and deploys the web application using the msdeploy.exe.

## Contact Information

Please contact the alias RM\_Customer\_Queries at microsoft dot com, if you are facing problems in making this task work. Also, if you would like to share feedback about the task and the new features that you would like to see in it, then do send an email to the alias.

## Pre-requisites for the task

The following pre-requisites need to be setup for the task to work properly.

### Web Deploy

Web Deploy (msdeploy.exe) is used to deploy the web application on the IIS server, and needs to be installed on the target machines, and can be easily done so using [Microsoft Web Platform Installer](http://www.microsoft.com/web/gallery/install.aspx?appid=wdeploynosmo). Note that the link will open Web PI with the Web Deploy showing-up ready to install. The WebDeploy 3.5 needs to be installed without the bundled SQL support and using the default settings. There is no need to choose any custom settings while installing web deploy. After installation the Web Deploy is available at C:\Program Files (x86)\IIS\Microsoft Web Deploy V3. The task [PowerShell on Target Machines](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/PowerShellOnTargetMachines) can be used to deploy Web Deploy to Azure virtual machines or domain-joined/workgroup machines.

AppCmd.exe is an in-built command line tool of IIS and does not need to be separately installed. It is used to create or update websites and application pools.

### IIS Web Server

There should be a IIS web server already installed and configured on the pre-existing machines or virtual machines. The task creates or updates websites and application pools, and deploys IIS web applications but does not install or configure IIS web server on the machines.

### Pre-existing Machine Groups

If the web application is being deployed on pre-existing machines (physical or virtual machines) then a machine group has to be created in the Machines Hub. There is a manage link next to the Machine Group parameter of the task. Click on the link to navigate to the Machines Hub and create a machine group. Note that the IP Address or the FDQN of Azure virtual machines can be also added in the machine group. The difference between using the domain-joined/workgroup machines and the Azure virtual machines is that copying files to them uses separate tasks wiz. [Windows Machine File Copy](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/WindowsMachineFileCopy) for the domain-joined/workgroup machines and [Azure File Copy](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/AzureFileCopy) for the Azure virtual machines. Note that the IIS Web Application Deployment task expects the web application's package zip files to be available on the machines or on a UNC path that is accessible by the machine administrator's login. Prior to using the IIS Web Application Deployment task ensure that the zip files are available for the deployment by copying them to the machines using the Windows Machine File Copy or the Azure File Copy tasks.

### Azure Resource Groups

To use dynamically deployed Azure virtual machines, use the [Azure Resource Group Deployment](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup) task to deploy the virtual machines in a Resource Group and then the name of the Resource Group can be typed in the Machine Group parameter of the IIS Web Application Deployment task. As described above, copy the web application's package zip files to the virtual machines in the Azure Resource Group using the [Azure File Copy](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/AzureFileCopy) task.

_NOTE: Currently existing Azure Resource Groups, classic (v1) or Azure Resource Manager (v2), cannot be used in the Build or Release Management definitions. Ability to select existing Resource Groups and to use the virtual machine resources in them to deploy applications to is coming soon._

### Windows Remote Management (WinRM) Setup

The IIS Web Application Deployment task uses the [Windows Remote Management](https://msdn.microsoft.com/en-us/library/aa384426(v=vs.85).aspx) (WinRM) to access domain-joined/workgroup machines or Azure virtual machines. WinRM is Microsoft's implementation of  [WS-Management Protocol](https://msdn.microsoft.com/en-us/library/aa384470(v=vs.85).aspx) that is firewall-friendly and provides a common way for systems to access and exchange management information across on-premises or Cloud IT infrastructure. The automation agent that runs the IIS Web Application Deployment task uses WinRM to communicate with the target machines. It is important to setup WinRM properly on the target machines else the deployment tasks will fail. The configuration of WinRM is described in detail on the MSDN [site](https://msdn.microsoft.com/en-us/library/aa384372(v=vs.85).aspx). For the target machines the following will ensure that the WinRM has been setup properly on them:

1. Azure virtual machines only work with the WinRM HTTPS protocol. When creating [classic](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) or [resource manager](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/) virtual machine from the Azure preview portal or Azure portal, the virtual machine is already setup for WinRM HTTPS, with the default port 5986 already open in Firewall, and a test certificate installed on the machine. These virtual machines can be directly added to a machine group, with the WinRM protocol selected as HTTPS, and the Skip CA Check option selected. The Skip CA Check means that the certificate is a test certificate and the client should skip the validation of the certificate by a trusted certification authority. 
2. To dynamically deploy Azure resource groups with virtual machines in them use the [Azure Resource Group Deployment](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup) task. The task has a sample template that can setup the WinRM HTTPS protocol on the virtual machines, open the 5986 port in the Firewall, and install the test certificate. After this the virtual machines are ready for use in the deployment task.
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
		<li> Credential in domain\\account name  or machine\\account name format. </li>
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

## Parameters of the task

The task can be used to deploy a web application to an existing website in the IIS web server using web deploy, and it can be also used for creating new IIS website and application pools, or to update existing ones. The task has three sections and the parameters of the different sections are described in detail below. The parameters listed with a \* are required parameters for the task.

The task first creates/updates the application pool, then creates/updates the websites, then applies the additional App.Cmd.exe commands, and then deploys the web application to the website using the web deploy. The application pool, website, and the additional AppCmd.exe sections are optional and if none of them are provided, then the task directly deploys the web application to the IIS website.

### Deploy IIS Web Application
This section of the task is used to deploy the web application to an existing IIS website and uses Web Deploy to do so.

  - **Machine Group\*:** The task runs in the target machine to deploy the web application. For this purpose, a target machine group has to be selected in this parameter. The dropdown will populate the pre-existing machine groups that have been created in the Machines Hub. To create a new machine group, or to edit/delete an existing one, click on the Manage link next to the machine group parameter. The link will open the Machines hub in a new tab. To use Azure virtual machines that have been created using the [Azure Resource Group Deployment](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup) task, manually type-in the name of the Resource Group in this parameter.
  - **Select Machines by:** The optional parameter is used to specify a subset of machine(s) in the machine group, where the task will run. The subset of machines can be specified using machine names or tags. The machine where the task will run should have the web deploy installed.
  - **Deploy to Machines:** The optional parameter is used to specify the machines where the task will run. Either a comma separated list of machine names can be provided like, webserver1.fabrikam.com, webserver2.fabrikam.com, 192.168.12.34, or tags can be provided like, Role:DB; OS:Win8.1. If multiple tags are provided, then the task will run in all the machines with the specified tags. For Azure Resource Groups, provide the virtual machine's name like, ffweb, ffdb. The virtual machine's name is its host name and not the DNS name or the IP address. The default is to run the task in all machines of the machine group or the resource group.
  - **Web Deploy Package\*:** Location of the web deploy zip package file on the target machine or on a UNC path that is accessible to the administrator credentials of the machine like, \\\\BudgetIT\Web\Deploy\FabrikamWeb.zip. Environment variables are also supported like $env:windir, $env:systemroot etc. For example, $env:windir\FabrikamFibre\Web.
  - **Web Deploy Parameters File:** The parameter file is used to override the default settings in the web deploy zip package file like, the IIS Web application name or the database connection string. This helps in having a single package that can be deployed across dev, test, staging, and production, with a specific parameter file for each environment. The parameter takes in the location of the parameter file on the target machines or on a UNC path.
  - **Override Parameters:** Parameters specified here will override the parameters in the MSDeploy zip file and the Parameter file. The format followed here is same as that for [setParam](https://technet.microsoft.com/en-us/library/dd569084(v=ws.10).aspx) option of MsDepoy.exe. For example, name="IIS Web Application Name", value="Fabrikam" ApplicationPath="Default Web Site/MyApplication"
 
### Website
The section of the task is used to create a new IIS website or to update an existing one by using the IIS Server's AppCmd.exe command line tool. For more information about the parameters see the [websites](https://technet.microsoft.com/library/hh831681.aspx#Add_Site) page on MSDN.
 
  - **Create or Update Website:** Select this option to create a new website or to update an existing one.
  - **Website Name\*:** The name of the IIS website that will be created if it does not exist, or it will be updated if it is already present on the IIS server. The name of the website should be same as that specified in the web deploy zip package file. If a Parameter file and override Parameters setting is also specified, then the name of the website should be same as that in the override Parameters setting.
  - **Physical Path\*:** Physical path where the website content is stored. The content can reside on the local computer or on a remote directory or share like, C:\Fabrikam or \\ContentShare\Fabrikam 
  - **Physical Path Authentication\*:** Specify credentials to connect to the physical path. If credentials are not provided, the web server uses pass-through authentication. This means that content is accessed by using the application user's identity, and configuration files are accessed by using the application pool's identity. By default, Application user (pass-through authentication) is selected.
  - **Username:** If Windows authentication is selected in the physical path authentication, then provide the username for accessing the physical path.
  - **Password:** Password of the user to access the physical path.
  - **Add Binding:** Select the option to add bindings for the website.
  - **Assign Duplicate Binding:** Selecting this option will add the bindings specified here, even if there is another website with the same bindings. If there are binding conflicts, then only one of the website will start.
  - **Protocol:** Select HTTP for the website to have an HTTP binding, or select HTTPS for the website to have a Secure Sockets Layer (SSL) binding.
  - **IP Address:** Type an IP address that users can use to access this website. If All Unassigned is selected, the site will respond to requests for all IP addresses on the port and the optional host name that is specified for this site, unless there is another site on the server that has a binding on the same port but with a specific IP address. For example, the default website binding specifies All Unassigned for IP address, and 80 for Port, and no host name. If the server has a second site named Fabrikam with a binding that specifies 172.30.189.132 for IP address on port 80 and no host name, Contoso receives all HTTP requests to port 80 on IP address 172.30.189.132, and the default website continues to receive HTTP requests to port 80 on any IP address other than 172.30.189.132.
  - **Port:** Type the port on which Hypertext Transfer Protocol Stack (HTTP.sys) must listen for requests made to this website. The default port for HTTP is 80 and for HTTPS it is 443. If any other port is specified, apart from the default ports, clients must specify the port number in requests to the server or they will not be able to connect to the website.
  - **Host Name:** To assign one or more host names (aka domain names) to a computer that uses a single IP address, type a host name here. If a host name is specified, then the clients must use the host name instead of the IP address to access the website.
  - **Server Name Indication Required:** Determines whether the website requires Server Name Indication (SNI). SNI extends the SSL and TLS protocols to indicate what host name the client is attempting to connect to. It allows multiple secure websites with different certificates to use the same IP address. The checkbox is displayed when the binding type is HTTPS. This parameter only works with IIS 8 and later versions of IIS. If SNI is selected, then host name should be also specified
  - **SSL Certificate Thumbprint:** Thumbprint of the Secure Socket Layer certificate that the website is going to use. The certificate should be already installed on the machine and present under the Local Computer, Personal store. 
  
### Application Pool
The section is used to create a new IIS application pool or to update an existing one by using the IIS Server's AppCmd.exe command line tool. For more information about the parameters see the [application pools](https://technet.microsoft.com/library/hh831797.aspx) page on MSDN.

  - **Create or Update Application Pool:** Select this option to create a new application pool or to update an existing one.
  - **Name\*:** The name of the IIS application pool that will be created if it does not exist, or it will be updated if it is already present on the IIS server. The name of the application pool should be same as that specified in the web deploy zip package file. If a Parameter file and override Parameters setting is also specified, then the name of the application pool should be same as that in the override Parameters setting.
  - **.NET Version\*:** Version of the .NET Framework that is loaded by this application pool. If the applications assigned to this application pool do not contain managed code, select the No Managed Code option from the list.
  - **Managed Pipeline Mode\*:** Managed pipeline mode specifies how IIS processes requests for managed content. Use classic mode only when the applications in the application pool cannot run in the Integrated mode.
  - **Identity\*:** Configure the account under which an application pool's worker process runs. Select one of the predefined security accounts or configure a custom account.

### Advanced
The section provides for advanced options.

  - **Additional AppCmd.exe Commands:** Additional [AppCmd.exe](https://technet.microsoft.com/en-us/library/cc732107(v=ws.10).aspx) commands to set website or application pool properties. For more than one command use line separator. For example:
  
      ```c
      set config /section:applicationPools /[name='Fabrikam'].autoStart:false 
	  add site /name:fabrikam /bindings:http/\*:85: fabrikam.com. 
      ```
	  
  - **Deploy in Parallel:** Setting it to true will run the database deployment task in-parallel on the target machines.

## Known Issues

  - The IIS Web Application Deployment task does not provide support for Web Deploy manifest files and has not been tested and verified for ASP.NET 5 and MVC 6 web application. Please send us feedback for the task and for the support for manifest files, ASP.NET 5/MVC 6 we applications at RM\_Customer\_Queries at microsoft dot com.
  - The Override Parameters can take only one parameter based on the [setParam](https://technet.microsoft.com/en-us/library/dd569084(v=ws.10).aspx) option of MsDepoy.exe