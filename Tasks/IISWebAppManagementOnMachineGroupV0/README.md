# IIS Web Application Management

## Overview

This task is used to manage an IIS website, web application, virtual directory or an application pool.

The task runs on the deployment target machine(s) registered with the Deployment Group configured for the task/phase. [Deployment Groups](https://opsstaging.www.visualstudio.com/en-gb/docs/release/getting-started/machine-group-agents?branch=users%2Fahomer%2Frelease-master) are logical groups of deployment target machines with agents installed on each of them. They also specify the security context and runtime targets for the agents. When authoring an Azure Pipelines Release definition, you can specify the deployments targets for a [phase](https://opsstaging.www.visualstudio.com/en-gb/docs/build/concepts/process/phases) using the deployment group.


## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The following pre-requisites need to be setup for the task to work properly.

### IIS Web Server

There should be a IIS web server already installed and configured on the pre-existing machines or virtual machines. Alternatively, you can use the "Enable IIS" option provided in the task to enable the IIS web server along with all of its sub-features on the machines (applicable only for Windows Server machines). The task updates websites, webapps and application pools. Also to deploy a webapp, use a different task [IIS WebApp Deployment On Deployment Group](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/IISWebAppDeploymentOnMachineGroup)

### Pre-existing Deployment Group

This task requires a Deployment group to execute. If the web application is to be created/updated on pre-existing machines (physical or virtual machines) then download the agent installer on each of the machines and register them with an existing Deployment group. If there is no pre-existing Deployment group, you can create one in the Deployment groups hub.

Carry out the following steps to create a Deployment group:
* Open your Azure Pipelines account in your web browser.
* Open the Deployment groups tab of the Build & Release hub and choose +Deployment group to create a new group
* Enter a name for the group in the Details tab and then save the group.
* In the Register machines using command line section, choose Regenerate script with PAT.
* Choose the icon to copy the script.
* Sign into the Azure virtual machine/physical machine where you wish to execute this task.
* Open an Administrator Powershell command prompt and paste the script you copied, then execute it to register the machine with this group.
* When prompted to configure tags for the agent, press Y and enter web.
* When prompted for the user account, press Return to accept the defaults.
* Wait for the script to finish with a message Service vstsagent.account.computername started successfully.
* In the Deployment groups page of the Build & Release hub, open the Machines tab and verify that the agent is running. If the tag named web is not visible, refresh the page.

## Parameters of the task

The task can be used to create/update a web application, website, virtual Directory, App pool in an IIS web server. The task parameters are described in detail below. The parameters listed with a \* are required parameters for the task.

* **Configuration type\*:** Choose whether you want to create/update an IIS web application or an IIS website or an IIS virtual directory or an IIS application pool. IIS Virtual Directory or an IIS Web Application are created as a child of an existing IIS Website.

* **Action\*:** Select the action to be performed. Create or Update , start, stop actions are supported based on the Configuration type selected. For App pool, Recycle option is also available.

The following parameters are selectively shown based on the configuration type and the action chosen:

* **Website Name\*:** The display name of the IIS Website to create or reconfigure. For IIS Virtual directory or IIS Web Application, provide the name of the parent website under which the directory/application will be created or updated.
* **Physical path\*:** Provide the physical path where the content of the website/virtual directory/web application will be stored. The content can reside on the local Computer, or in a remote directory, or on a network share, like 'C:\Fabrikam or \\ContentShare\Fabrikam'.
* **Virtual path\*:** Provide the virtual path in IIS relative to the parent website.
Example: To create an application Site/Application enter /Application. The parent website should be already existing.
         To create a virtual directory Site/Application/VDir enter /Application/Vdir. The parent website and application should be already existing.
* **Physical path authentication\*:** Select the authentication mechanism that will be used to access the physical path of the website/virtual directory/web application.
* **Add binding\*:** Select the option to add port binding for the website.
* **Create or update app pool\*:** Select the option to create or update an application pool. If checked, the website/application will be created in the specified app pool.

The following parameters are shown for an IIS Application Pool:

* **Name\*:** Name of the Application Pool in IIS
* **.NET version\*:** The version of the .NET common language runtime that tis loaded by the application pool. Choose v2.0 for applications built against .NET 2.0, 3.0 or 3.5. Choose v4.0 for .NET 4.0 or 4.5. If the applications assigned to this application pool do not contain managed code, then select the 'No Managed Code' option from the list.
* **Managed pipeline mode\*:** Select the managed pipeline mode that specifies how IIS processes requests for managed content. Use classic mode only when the applications in the application pool cannot run in the Integrated mode.
* **Identity\*:** Configure the built-in account under which an application pool's worker process runs. Select one of the predefined security accounts or configure a custom account.
* **Username\*:** The Windows/domain account of the custom user that the application pool will run under. Example: YOURDOMAIN\YourAccount. You will need to ensure that this user has permissions to run as an application pool.
* **Password\*:** The password for the custom account given above. The best practice is to create a variable in the Build or Release definition, and mark it as 'Secret' to secure it, and then use it here, like '$(userCredentials)'. Note: Special characters in password are interpreted as per [command-line arguments](https://go.microsoft.com/fwlink/?linkid=843470)

Task now supports you to configure multiple HTTP/HTTPS bindings that should be added to the IIS Web Site. The following parameters are shown for an IIS Binding:
* **Protocol\*:** Select HTTP for the website to have an HTTP binding, or select HTTPS for the website to have a Secure Sockets Layer (SSL) binding.
* **IP address\*:** Provide an IP address that end-users can use to access this website. If 'All Unassigned' is selected, then the website will respond to requests for all IP addresses on the port and for the host name, unless another website on the server has a binding on the same port but with a specific IP address.
* **Port\*:** Provide the port, where the Hypertext Transfer Protocol Stack (HTTP.sys) will listen to the website requests.
* **Server Name Indication required\*:** Select the option to set the Server Name Indication (SNI) for the website. SNI extends the SSL and TLS protocols to indicate the host name that the clients are attempting to connect to. It allows, multiple secure websites with different certificates, to use the same IP address.
* **Host name\*:** Enter a host name (or domain name) for the website.  Example: www.contoso.com. Leave empty to use any host header. If a host name is specified, then the clients could use the host name instead of the IP address to access the website.
* **SSL certificate thumbprint\*:** Provide the thumb-print of the Secure Socket Layer certificate that the website is going to use for the HTTPS communication as a 40 character long hexadecimal string. The SSL certificate should be already installed on the Computer, at Local Computer, Personal store.


**Authentication modes:** Choose the authentication mode(s) IIS should enable for the website. Currently Windows, Basic and Anonymous authentication modes are supported. By default, Windows authentication mode is chosen. You can select more than one authentication mode. You could also use additional Appcmd.exe commands to [configure other authentication modes](https://technet.microsoft.com/en-us/library/cc733010(v=ws.10).aspx).

### Advanced Deployment Options
* **Additional appcmd.exe commands:** Enter additional AppCmd.exe commands. For more than one command use a line separator, like list apppools, list sites, recycle apppool /apppool.name:ExampleAppPoolName
