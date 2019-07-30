# IIS Web Application Deployment

## **Important Notice**
The preview IIS Web Application Deployment task has been **deprecated and will be removed soon**. The task has been **shipped as an extension for Visual Studio Team Services**, and is available in the marketplace - https://marketplace.visualstudio.com/items?itemName=ms-vscs-rm.iiswebapp.

**Install the extension, and add the tasks from the extension in Build or Release Definitions, and remove this IIS Web Application Deployment task from the definition.**


## Overview

The task is used to deploy a web application or a website to IIS web server and to create or update websites and application pools, and the underlying technologies used by the task is [Web Deploy](https://www.iis.net/downloads/microsoft/web-deploy) and [AppCmd.exe](https://www.iis.net/learn/get-started/getting-started-with-iis/getting-started-with-appcmdexe). Web Deploy packages the web application content, configuration and any other artifacts like registry, GAC assemblies etc. that can be used deployment. If the package needs to be redeployed to a different environment, configuration values within the package can be parameterized during deployment without requiring modifications to the packages themselves. Web deploy works with IIS 7, IIS 7.5, IIS 8, and IIS 8.5. AppCmd.exe is the single command line tool for managing IIS 7 and above. It exposes all key server management functionality through a set of intuitive management objects that can be manipulated from the command line or from scripts.

The task runs on the target machine(s) and it is important to have the pre-requisites, as described below, installed on the machine(s). The flow is that the automation agent when executing the task, connects to the target machine using the Windows Remote Management (WinRM), and then launches a bootstrap service, which in turn invokes the PowerShell scripts to locate the msdeploy.exe on the machine, and deploys the web application using the msdeploy.exe.

## Contact Information

Please contact the alias RM\_Customer\_Queries at microsoft dot com, if you are facing problems in making this task work. Also, if you would like to share feedback about the task and the new features that you would like to see in it, then do send an email to the alias.

## Pre-requisites for the task

The following pre-requisites need to be setup for the task to work properly.

### Web Deploy

Web Deploy (msdeploy.exe) is used to deploy the web application on the IIS server, and needs to be installed on the target machines, and can be easily done so using [Microsoft Web Platform Installer](https://www.microsoft.com/web/gallery/install.aspx?appid=wdeploynosmo). Note that the link will open Web PI with the Web Deploy showing-up ready to install. The WebDeploy 3.5 needs to be installed without the bundled SQL support and using the default settings. There is no need to choose any custom settings while installing web deploy. After installation the Web Deploy is available at C:\Program Files (x86)\IIS\Microsoft Web Deploy V3. The task [PowerShell on Target Machines](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/PowerShellOnTargetMachinesV3) can be used to deploy Web Deploy to Azure virtual machines or domain-joined/workgroup machines.

AppCmd.exe is an in-built command line tool of IIS and does not need to be separately installed. It is used to create or update websites and application pools.

### IIS Web Server

There should be a IIS web server already installed and configured on the pre-existing machines or virtual machines. The task creates or updates websites and application pools, and deploys IIS web applications but does not install or configure IIS web server on the machines.

### Pre-existing Machine Groups

If the web application is being deployed on pre-existing machines (physical or virtual machines) then a machine group has to be created in the Machines Hub. There is a manage link next to the Machine Group parameter of the task. Click on the link to navigate to the Machines Hub and create a machine group. Note that the IP Address or the FDQN of Azure virtual machines can be also added in the machine group. The difference between using the domain-joined/workgroup machines and the Azure virtual machines is that copying files to them uses separate tasks wiz. [Windows Machine File Copy](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/WindowsMachineFileCopyV2) for the domain-joined/workgroup machines and [Azure File Copy](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzureFileCopyV2) for the Azure virtual machines. Note that the IIS Web Application Deployment task expects the web application's package zip files to be available on the machines or on a UNC path that is accessible by the machine administrator's login. Prior to using the IIS Web Application Deployment task ensure that the zip files are available for the deployment by copying them to the machines using the Windows Machine File Copy or the Azure File Copy tasks.

### WinRM setup
This task uses the [Windows Remote Management](https://msdn.microsoft.com/en-us/library/aa384426.aspx) (WinRM) to access domain-joined or workgroup, on-premises physical or virtual machines.

#### Windows Remote Management (WinRM) Setup for On-premises Physical or Virtual Machines
To easily **setup WinRM** on the **host machines** follow the directions for [domain-joined machines](https://www.visualstudio.com/en-us/docs/release/examples/other-servers/net-to-vm) or the [workgroup machines](https://www.visualstudio.com/en-us/docs/release/examples/other-servers/net-to-workgroup-vm).

#### Windows Remote Management (WinRM) Setup for Azure Virtual Machines
Azure virtual machines only work with the WinRM HTTPS protocol. With the WinRM protocol selected as HTTPS, you have an option to use the Test Certificate. Selecting the Test Certificate option means that the certificate is a self-signed certificate, and the automation agent will skip validating the authenticity of the machine's certificate from a trusted certification authority.

-	**Classic Virtual machines:** When creating [classic virtual machine](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) from the [new Azure portal](https://portal.azure.com/) or the [classic Azure portal](https://manage.windowsazure.com/), the virtual machine is already setup for WinRM HTTPS, with the default port 5986 already open in Firewall, and a self-signed certificate installed on the machine. These virtual machines can be directly added to the WinRM. The existing [classic virtual machine](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial-classic-portal/) can be also selected by using the [Azure Resource Group Deployment task](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup).

- **•	Azure Resource Group:** If an [Azure resource group](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-hero-tutorial/) has been created in the [new Azure portal](https://portal.azure.com/), then it needs to be setup for the WinRM HTTPS protocol (WinRM HTTPS, with the default port 5986 already open in Firewall, and a self-signed certificate installed on the machine). To dynamically deploy Azure resource groups with virtual machines in them use the [Azure Resource Group Deployment task](https://github.com/Microsoft/vso-agent-tasks/tree/master/Tasks/DeployAzureResourceGroup). The task has a checkbox titled - **Enable Deployment Pre-requisites**. Select this option to setup the WinRM HTTPS protocol on the virtual machines, and to open the 5986 port in the Firewall, and to install the test certificate. After this the virtual machines are ready for use in the deployment task.

## Parameters of the task

The task can be used to deploy a web application to an existing website in the IIS web server using web deploy, and it can be also used for creating new IIS website and application pools, or to update existing ones. The task has three sections and the parameters of the different sections are described in detail below. The parameters listed with a \* are required parameters for the task.

The task first creates/updates the application pool, then creates/updates the websites, then applies the additional App.Cmd.exe commands, and then deploys the web application to the website using the web deploy. The application pool, website, and the additional AppCmd.exe sections are optional and if none of them are provided, then the task directly deploys the web application to the IIS website.

### Deploy IIS Web Application
This section of the task is used to deploy the web application to an existing IIS website and uses Web Deploy to do so.

 - **Machines**: Specify comma separated list of machine FQDNs/ip addresses along with port(optional). For example dbserver.fabrikam.com, dbserver_int.fabrikam.com:5986,192.168.34:5986. Port when not specified will be defaulted to WinRM defaults based on the specified protocol. i.e., (For *WinRM 2.0*):  The default HTTP port is 5985, and the default HTTPS port is 5986. Machines field also accepts 'Machine Groups' defined under 'Test' hub, 'Machines' tab.
 - **Admin Login**: Domain/Local administrator of the target host. Format: &lt;Domain or hostname&gt;\ &lt; Admin User&gt;. Mandatory when used with list of machines, optional for Test Machine Group (will override test machine group value when specified).
 - **Password**:  Password for the admin login. It can accept variable defined in Build/Release definitions as '$(passwordVariable)'. You may mark variable type as 'secret' to secure it. Mandatory when used with list of machines, optional for Test Machine Group (will override test machine group value when specified).
 - **Protocol**:  Specify the protocol that will be used to connect to target host, either HTTP or HTTPS.
 - **Test Certificate**: Select the option to skip validating the authenticity of the machine's certificate by a trusted certification authority. The parameter is required for the WinRM HTTPS protocol.
 - **Web Deploy Package\*:** Location of the web deploy zip package file on the target machine or on a UNC path that is accessible to the administrator credentials of the machine like, \\\\BudgetIT\Web\Deploy\FabrikamWeb.zip. Environment variables are also supported like $env:windir, $env:systemroot etc. For example, $env:windir\FabrikamFibre\Web.
  - **Web Deploy Parameters File:** The parameter file is used to override the default settings in the web deploy zip package file like, the IIS Web application name or the database connection string. This helps in having a single package that can be deployed across dev, test, staging, and production, with a specific parameter file for each environment. The parameter takes in the location of the parameter file on the target machines or on a UNC path.
  - **Override Parameters:** Parameters specified here will override the parameters in the MSDeploy zip file and the Parameter file. The format followed here is same as that for [setParam](https://technet.microsoft.com/en-us/library/dd569084(v=ws.10).aspx) option of MsDeploy.exe. For example, name="IIS Web Application Name",value="Fabrikam/MyApplication"

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
  - The Override Parameters can take only one parameter based on the [setParam](https://technet.microsoft.com/en-us/library/dd569084(v=ws.10).aspx) option of MsDeploy.exe
