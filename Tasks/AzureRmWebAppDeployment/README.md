#  Azure App Service Deployment: ARM 

## Overview

The Azure App Service Deployment task is used to update Azure App Service to deploy [Web Apps](https://azure.microsoft.com/en-in/documentation/articles/app-service-web-overview/) and [WebJobs](https://azure.microsoft.com/en-us/blog/webjobs-goes-into-full-production/) to Azure. The task works with the [Azure Resource Manager APIs](https://msdn.microsoft.com/en-us/library/azure/dn790568.aspx) only. The task works on cross platform agents running Windows, Linux or Mac and uses the underlying deployment technologies of [Web Deploy](https://www.iis.net/downloads/microsoft/web-deploy) and [Kudu](https://github.com/projectkudu/kudu/wiki/REST-API).
The task works for ASP.NET, ASP.NET Core 1 and Node.js based web applications.

The task is **under development and is available to a limited set of accounts on Visual Studio Team Services (VSTS)**. The [video](https://www.youtube.com/watch?v=uQ2qCmaZ_Ag&feature=youtu.be) describes the features that are available in the task currently.

## Contact Information

Please contact the alias RM\_Customer\_Queries at microsoft dot com, if you are facing problems in making this task work. Also, share feedback about the task, and the new features that you would like to see in it.

## Pre-requisites for the task

The following pre-requisites need to be setup in the target machine(s) for the task to work properly.

##### Azure Web App

The task is used to deploy a Web  project to an existing Azure Web App. The Web App should exist prior to running the task. The Web App can be created from the [Azure portal](https://azure.microsoft.com/en-in/documentation/videos/azure-app-service-web-apps-with-yochay-kiriaty/) and [configured](https://azure.microsoft.com/en-us/documentation/articles/web-sites-configure/) there. Alternatively, the [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell) can be used to run [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx) to provision and configure the Web App.

##### Azure Subscription

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Visual Studio Team Services using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.

Create the [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/) service endpoint, use **'Azure Resource Manager'** endpoint type, for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

The task does not work with the Azure Classic service endpoint and it will not list these connections in the parameters in the task.

##### Azure PowerShell

The task needs the Azure PowerShell version to be installed on the automation agent, and that can be done easily using the [Azure PowerShell Installer v1.3.0](https://github.com/Azure/azure-powershell/releases/tag/v1.3.0-March2016).

### Web Deploy

On a Windows automation agent, Web Deploy (msdeploy.exe) is used to deploy the web application to the Azure Web App.  Install it on the agent using the [Microsoft Web Platform Installer](https://www.microsoft.com/web/gallery/install.aspx?appid=wdeploynosmo). Note that the link will open Web PI with the Web Deploy showing-up ready to install. The Web Deploy 3.5 needs to be installed without the bundled SQL support. There is no need to choose any custom settings while installing Web Deploy. After installing the Web Deploy is available at C:\\Program Files (x86)\\IIS\\Microsoft Web Deploy V3.

## Parameters of the task

The task is used to deploy a Web  project to an existing Azure Web App. The mandatory fields are highlighted with a *.

* **Azure Subscription\*:** Select the AzureRM Subscription. If none exists, then click on the **Manage** link, to navigate to the Services tab in the Administrators panel. In the tab click on **New Service Endpoint** and select **Azure Resource Manager** from the dropdown.

* **App Service Name\*:** Select the name of an existing AzureRM Web Application. Enter the name of the Web App if it was provisioned dynamically using the [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell) and [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx).

* **Deploy to Slot:** Select the option to deploy to an existing slot other than the Production slot. Do not select this option if the Web project is being deployed to the Production slot. The Web App itself is the Production slot.

* **Resource Group:** Select the Azure Resource Group that contains the AzureRM Web App specified above. Enter the name of the Azure Resource Group if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/DeployAzureResourceGroup) or [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell). This is a required parameter if the option to Deploy to Slot has been selected.

* **Slot:** Select the Slot to deploy the Web project to. Enter the name of the Slot if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/DeployAzureResourceGroup) or [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell). This is a required parameter if the option to Deploy to Slot has been selected.

* **Virtual Application:** Specify the name of the Virtual Application that has been configured in the Azure portal. The option is not required for deployments to the website root. The Virtual Application should have been [configured](https://azure.microsoft.com/en-us/documentation/articles/web-sites-configure/) prior to deploying the Web project to it using the task.

* **Package or Folder\*:** Location of the Web App zip package or folder on the automation agent or on a UNC path accessible to the automation agent like, \\\\BudgetIT\\Web\\Deploy\\Fabrikam.zip. Predefined system variables and wild cards like, $(System.DefaultWorkingDirectory)\\\***.zip can be also used here.

* **Publish using Web Deploy:** Select the option to use Web Deploy technology on a Windows Agent. On other platforms, the task implicitly relies on [Kudu REST APIs](https://github.com/projectkudu/kudu/wiki/REST-API) to deploy the web App and following Web deploy options are not supported.

* **Parameters File:** (Optional) The parameter file is used to override the default settings in the web deploy zip package file like, the IIS Web application name or the database connection string. This helps in having a single package that can be deployed across dev, test, staging, and production, with a specific parameter file for each environment.

* **Remove Additional Files at Destination:** Select the option to delete the files in the AzureRM Web App that have no matching files in the Web App zip package. This will ensure that during the Web project deployment any additional files in the AzureRM Web App are deleted, and the only files in the AzureRM Web App are the ones in the Web App zip package.

* **Exclude Files from the App_Data Folder:** Select the option to prevent files in the App_Data folder from being deployed to the AzureRM Web App. This is a useful option to select, if a local database or a WebJob has been deployed earlier to the AzureRM Web App, and they should not be deleted in the subsequent deployments of the Web project.

* **Take Application Offline:** Select the option to take the AzureRM Web App offline by placing an app_offline.htm file in the root directory of the Web App before the sync operation begins. The file will be removed after the sync operation completes successfully.

* **Additional Arguments:** Additional Web Deploy arguments that will be appended to the MSDeploy command while deploying the Azure Web App like,-disableLink:AppPoolExtension -disableLink:ContentExtension. A useful parameter for enabling and disabling rules and for skipping syncing of certain folders.

### Output Variables

* **Web App Hosted URL:** Provide a name, like FabrikamWebAppURL for the variable for the AzureRM Web App Hosted URL. The variable can be used as $(variableName), like $(FabrikamWebAppURL) to refer to the Hosted URL of the AzureRM Web App in subsequent tasks like in the [Run Functional Tests task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/RunDistributedTests) or the [Visual Studio Test task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/VsTest).
