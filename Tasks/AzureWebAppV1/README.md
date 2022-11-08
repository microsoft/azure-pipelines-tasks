#  Azure Web App Deployment: ARM 

## Overview

The Azure Web App task is used to update different Azure App Service to deploy [Web Apps](https://azure.microsoft.com/en-in/documentation/articles/app-service-web-overview/), [Functions](https://docs.microsoft.com/en-us/azure/azure-functions/) and [WebJobs](https://azure.microsoft.com/en-us/blog/webjobs-goes-into-full-production/) to Azure. The task works on cross platform Azure Pipelines agents running Windows, Linux or Mac and uses the underlying deployment technologies of RunFromPackage, Zip Deploy, Containers and [Kudu REST APIs](https://github.com/projectkudu/kudu/wiki/REST-API).

The task works for [ASP.NET](https://www.visualstudio.com/en-us/docs/release/examples/azure/azure-web-apps-from-build-and-release-hubs), [ASP.NET Core](https://www.visualstudio.com/en-us/docs/release/examples/azure/aspnet-core10-azure-web-apps), PHP, Java, Python, Go and [Node.js](https://www.visualstudio.com/en-us/docs/release/examples/nodejs/node-to-azure-webapps) based web applications.

The task can be used to deploy different Azure App Services like Function App (Windows/Linux/Containers), Web App on Windows, Web App on Linux, Web App for Containers and apps configured under Azure App Service Environments.

The task is **under development and is available to a limited set of Azure DevOps organizations**. The [video](https://www.youtube.com/watch?v=uQ2qCmaZ_Ag&feature=youtu.be) describes the features that are available in the task currently.

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The following pre-requisites need to be setup in the target machine(s) for the task to work properly.

##### Azure Web App or Azure Function

The task is used to deploy a Web  project to an existing Azure Web App. The Web App should exist prior to running the task. The Web App can be created from the [Azure portal](https://azure.microsoft.com/en-in/documentation/videos/azure-app-service-web-apps-with-yochay-kiriaty/) and [configured](https://azure.microsoft.com/en-us/documentation/articles/web-sites-configure/) there. Alternatively, the [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell) can be used to run [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx) to provision and configure the Web App.

The task can also be used to deploy [Azure Functions](https://azure.microsoft.com/en-in/services/functions/) (Windows/Linux/Containers).

##### Azure Subscription

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.

Create the [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/) service endpoint, use **'Azure Resource Manager'** endpoint type, for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

The task does not work with the Azure Classic service endpoint and it will not list these connections in the parameters in the task.

## Deployment

Several deployment methods are available in this task. To change the deployment option, expand Additional Deployment Options and enable Select deployment method to choose from additional package-based deployment options.

Based on the type of Azure App Service and Azure Pipelines agent, the task chooses a suitable deployment technology. The different deployment technologies used by the task are:

* *Kudu REST APIs*

* *Container Registry* 

* *Zip Deploy* 

* *RunFromPackage* 

By default the task tries to select the appropriate deployment technology given the input package, app service type and agent OS.

* When the App Service type is Web App on Linux App, use Zip Deploy 
* If War file is provided, use War Deploy 
* If Jar file is provided, use Run From Zip 
* For all others, use Run From Zip (via Zip Deploy) 

On non-Windows agent (for any App service type), the task relies on [Kudu REST APIs](https://github.com/projectkudu/kudu/wiki/REST-API) to deploy the Web App.

### [Kudu REST APIs](https://github.com/projectkudu/kudu/wiki/REST-API)
Works on a Windows as well as Linux automation agent when the target is a Web App on Windows or Web App on Linux (built-in source) or Function App. The task uses Kudu to copy over files to the Azure App service.

### Container Registry
Works on a Windows as well as Linux automation agent when the target is a Web App for Containers. The task updates the Azure Web App for Containers by setting the right Container registry, repository, image name and tag information. You can also use the task to pass a startup command for the container image.

### Zip Deploy
Creates a .zip deployment package of the chosen Package or folder and deploys the file contents to the wwwroot folder of the App Service name function app in Azure. This option overwrites all existing contents in the wwwroot folder. For more information, see [Zip deployment for Azure Functions](https://docs.microsoft.com/azure/azure-functions/deployment-zip-push).

### RunFromPackage
Creates the same deployment package as Zip Deploy. However, instead of deploying files to the wwwroot folder, the entire package is mounted by the Functions runtime. With this option, files in the wwwroot folder become read-only. For more information, see [Run your Azure Functions from a package file](https://docs.microsoft.com/azure/azure-functions/run-functions-from-deployment-package).

### Parameters of the task
The task is used to deploy a Web  project to an existing Azure Web App or Function. The mandatory fields are highlighted with a *.

* **Azure Subscription\*:** Select the AzureRM Subscription. If none exists, then click on the **Manage** link, to navigate to the Services tab in the Administrators panel. In the tab click on **New Service Endpoint** and select **Azure Resource Manager** from the dropdown.

* **App Service type\*:** Select the Azure App Service type. The different app types supported are Function App, Web App on Windows, Web App on Linux, Web App for Containers and Azure App Service Environments

* **App Service Name\*:** Select the name of an existing Azure App Service. Enter the name of the Web App if it was provisioned dynamically using the [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell) and [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx).

* **Deploy to Slot:** Select the option to deploy to an existing slot other than the Production slot. Do not select this option if the Web project is being deployed to the Production slot. The Web App itself is the Production slot.

* **Resource Group:** Select the Azure Resource Group that contains the Azure App Service specified above. Enter the name of the Azure Resource Group if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/DeployAzureResourceGroup) or [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell). This is a required parameter if the option to Deploy to Slot has been selected.

* **Slot:** Select the Slot to deploy the Web project to. Enter the name of the Slot if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/DeployAzureResourceGroup) or [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell). This is a required parameter if the option to Deploy to Slot has been selected.

* **Package or Folder\*:** Location of the Web App zip package or folder on the automation agent or on a UNC path accessible to the automation agent like, \\\\BudgetIT\\Web\\Deploy\\Fabrikam.zip. Predefined system variables and wild cards like, $(System.DefaultWorkingDirectory)\\\***.zip can be also used here.

* **Select deployment method:** Select the option to choose from  auto, zipDeploy and runFromPackage. Default value is Auto-detect where the task tries to select the appropriate deployment technology given the input package, app service type and agent OS.


* **Runtime Stack:**
Web App on Linux offers two different options to publish your application, one is Custom image deployment (Web App for Containers) and the other is App deployment with a built-in platform image (Web App on Linux). You will see this parameter only when you selected 'Linux Web App' in the App type selection option in the task.

For Web **Web App for Containers** you need to provide the following details:
* *Registry or Namespace:*
A globally unique top-level domain name for your specific registry or namespace. A fully qualified image name will be of the format: '<registry or namespace>/<repository>:<tag>'. For example, 'myregistry.azurecr.io/nginx:latest'.
  
* *Image:*
Image Name of the repository where the container images are stored. A fully qualified image name will be of the format: '<registry or namespace>/<repository>:<tag>'. For example, 'myregistry.azurecr.io/nginx:latest'.

* *Tag:*
Tags are optional, it is the mechanism that registries use to give Docker images a version. A fully qualified image name will be of the format: '<registry or namespace>/<repository>:<tag>'. For example, 'myregistry.azurecr.io/nginx:latest'.
  
* *Startup command:*
Start up command for the container.
  
For Web **Web App on Linux** you need to provide the following details:
* *Runtime stack:* Select the framework and version your web app will run on.
  
* *Startup command:*
Start up command for the app. For example if you are using PM2 process manager for Nodejs then you can specify the PM2 file here.

* *Application and Configuration Settings*

**App settings**: [App settings](https://docs.microsoft.com/en-us/azure/app-service/web-sites-configure#app-settings) contains name/value pairs that your web app will load on start up. Edit web app application settings by following the syntax '-key value'. Value containing spaces should be enclosed in double quotes.
>Example : -Port 5000 -RequestTimeout 5000 
>-WEBSITE_TIME_ZONE "Eastern Standard Time"

**Configuration settings**:
Edit web app [configuration settings](https://docs.microsoft.com/en-us/azure/app-service/web-sites-configure) following the syntax -key value. Value containing spaces should be enclosed in double quotes.
>Example : -phpVersion 5.6 -linuxFxVersion: node|6.11

### Output Variables

* **Web App Hosted URL:** Provide a name, like FabrikamWebAppURL for the variable for the Azure App Service Hosted URL. The variable can be used as $(variableName), like $(FabrikamWebAppURL) to refer to the Hosted URL of the Azure App Service in subsequent tasks like in the [Run Functional Tests task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/RunDistributedTests) or the [Visual Studio Test task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/VsTest).


### FAQ
* To ignore SSL error set a Variable of name VSTS_ARM_REST_IGNORE_SSL_ERRORS with value : true in the release definition.
* The task works with the [Azure Resource Manager APIs](https://msdn.microsoft.com/en-us/library/azure/dn790568.aspx) only.
* For avoiding deployment failure with error code ERROR_FILE_IN_USE, in case of .NET apps targeting Web App on Windows, ensure that 'Rename locked files' and 'Take App Offline' are enabled. For zero downtime deployment use slot swap.
* When deploying to an App Service with App Insights configured, if you have enabled “Remove additional files at destination” then you also need to enable “Exclude files from the App_Data folder” in order to keep App insights extension in safe state. This is required because App Insights continuous web job gets installed into the App_Data folder. 
