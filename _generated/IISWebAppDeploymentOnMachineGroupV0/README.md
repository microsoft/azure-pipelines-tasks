# IIS Web Application Deployment

## Overview

The task is used to deploy a web application or a website to IIS web server, and the underlying technologies used by the task is [Web Deploy](https://www.iis.net/downloads/microsoft/web-deploy). Web Deploy packages the web application content, configuration and any other artifacts like registry, GAC assemblies etc. that can be used deployment. If the package needs to be redeployed to a different environment, configuration values within the package can be parameterized during deployment without requiring modifications to the packages themselves. Web deploy works with IIS 7, IIS 7.5, IIS 8, and IIS 8.5.

The task runs on the deployment target machine(s) registered with the Deployment Group configured for the task/phase. Deployment Groups are logical groups of deployment target machines with agents installed on each of them. They also specify the security context and runtime targets for the agents. When authoring Azure Pipelines Release definition, you can specify the deployments targets for a Phase using the deployment group.


## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The following pre-requisites need to be setup for the task to work properly.

### Web Deploy

Web Deploy (msdeploy.exe) is used to deploy the web application on the IIS server, and needs to be installed on the target machines, and can be easily done so using [Microsoft Web Platform Installer](https://www.microsoft.com/web/gallery/install.aspx?appid=wdeploynosmo). Note that the link will open Web PI with the Web Deploy showing-up ready to install. The WebDeploy 3.5 needs to be installed without the bundled SQL support and using the default settings. There is no need to choose any custom settings while installing web deploy. After installation the Web Deploy is available at C:\Program Files (x86)\IIS\Microsoft Web Deploy V3. The task [PowerShell on Target Machines](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/PowerShellOnTargetMachinesV3) can be used to deploy Web Deploy to Azure virtual machines or domain-joined/workgroup machines.

### IIS Web Server

There should be a IIS web server already installed and configured on the pre-existing machines or virtual machines. The task updates websites and application pools, and deploys IIS web applications but does not install or configure IIS web server on the machines.

### Pre-existing Deployment Group

This task requires a deployment group to execute. If the web application is being deployed on pre-existing machines (physical or virtual machines) then download the agent installer on each of the machines and register them with an existing deployment group by following these [instructions](). If there is no pre-existing deployment group, you can create one in the deployment groups hub.
Note that the IP Address or the FDQN of Azure virtual machines can be also added in the deployment group.
The difference between using the domain-joined/workgroup machines and the Azure virtual machines is that copying files to them uses separate tasks wiz. [Windows Machine File Copy](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/WindowsMachineFileCopyV2) for the domain-joined/workgroup machines and [Azure File Copy](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzureFileCopyV2) for the Azure virtual machines. Note that the IIS Web Application Deployment task expects the web application's package zip files to be available on the machines or on a UNC path that is accessible by the machine administrator's login. Prior to using the IIS Web Application Deployment task ensure that the zip files are available for the deployment by copying them to the machines using the Windows Machine File Copy or the Azure File Copy tasks.

## Parameters of the task

The task can be used to deploy a web application to an existing website in the IIS web server using web deploy. The task parameters are described in detail below. The parameters listed with a \* are required parameters for the task.

The task deploys the web application to the website using the web deploy.

* **Website Name\*:** The name of the IIS website where the Web App will be deployed.

* **Virtual Application:** Specify the name of the Virtual Application that has been configured on the IIS Server. The option is not required for deployments to the website root. The Virtual Application should have been configured prior to deploying the Web project to it using the task.

* **Package or Folder\*:** Location of the Web App zip package or folder on the automation agent or on a UNC path accessible to the automation agent like, \\\\BudgetIT\\Web\\Deploy\\Fabrikam.zip. Predefined system variables and wild cards like, $(System.DefaultWorkingDirectory)\\\***.zip can be also used here.

### Advanced Deployment Options
* **Set Parameters File:** The parameter file is used to override the default settings in the web deploy zip package file like, the IIS Web application name or the database connection string. This helps in having a single package that can be deployed across dev, test, staging, and production, with a specific parameter file for each environment.

* **Remove Additional Files at Destination:** Select the option to delete the files in the Web App that have no matching files in the Web App zip package. This will ensure that during the Web project deployment any additional files in the Web App are deleted, and the only files in the Web App are the ones in the Web App zip package.

* **Exclude Files from the App_Data Folder:** Select the option to prevent files in the App_Data folder from being deployed to the Web App/Website. This is a useful option to select, if a local database or a WebJob has been deployed earlier to the Web App, and they should not be deleted in the subsequent deployments of the Web project.

* **Take Application Offline:** Select the option to take the Web App offline by placing an app_offline.htm file in the root directory of the Web App before the sync operation begins. The file will be removed after the sync operation completes successfully.

* **Additional Arguments:** Additional Web Deploy arguments that will be appended to the MSDeploy command while deploying the Web App like,-disableLink:AppPoolExtension -disableLink:ContentExtension. A useful parameter for enabling and disabling rules and for skipping syncing of certain folders.

* **File transformation and variable substitution:**  Refer to following links:
  * [XML transformation](https://docs.microsoft.com/en-us/vsts/build-release/tasks/transforms-variable-substitution?view=vsts#xml-transformation)
  * [XML variable substitution](https://docs.microsoft.com/en-us/vsts/build-release/tasks/transforms-variable-substitution?view=vsts#xml-variable-substitution)
  * [JSON variable substitution](https://docs.microsoft.com/en-us/vsts/build-release/tasks/transforms-variable-substitution?view=vsts#json-variable-substitution)

