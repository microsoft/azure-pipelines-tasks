#  Azure Function Deployment: ARM 

## Overview

The Azure Function Deployment task is used to update Azure Functions to deploy [Functions](https://docs.microsoft.com/en-us/azure/azure-functions/) to Azure. The task works on cross platform Azure Pipelines agents running Windows, Linux or Mac and uses the underlying deployment technologies of RunFromPackage, Zip Deploy and [Kudu REST APIs](https://github.com/projectkudu/kudu/wiki/REST-API).

The task works for the Azure Functions [Supported Languages](https://docs.microsoft.com/en-us/azure/azure-functions/supported-languages).

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The following pre-requisites need to be setup in the target machine(s) for the task to work properly.

##### Azure Function

The task is used to deploy an Auzre Functions project to an existing Azure Function. The Azure Function app should exist prior to running the task. The Azure Function App can be created from the [Azure portal](https://docs.microsoft.com/en-us/azure/azure-functions/functions-create-function-app-portal) . Alternatively, the [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell) can be used to run [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx) to provision and configure the Azure Function app.

The task can be used to deploy [Azure Functions](https://azure.microsoft.com/en-in/services/functions/) (Windows/Linux).

##### Azure Subscription

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.

Create the [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/) service endpoint, use **'Azure Resource Manager'** endpoint type, for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

The task does not work with the Azure Classic service endpoint and it will not list these connections in the parameters in the task.

## Deployment

Several deployment methods are available in this task. To change the deployment option, expand Additional Deployment Options and enable Select deployment method to choose from additional package-based deployment options.

Based on the type of Azure App Service and Azure Pipelines agent, the task chooses a suitable deployment technology. The different deployment technologies used by the task are:

* *Kudu REST APIs*

* *Zip Deploy* 

* *RunFromPackage* 

By default the task tries to select the appropriate deployment technology given the input package, app service type and agent OS.

* When post deployment script is provided, use Zip Deploy 
* When the App Service type is Web App on Linux App, use Zip Deploy 
* If War file is provided, use War Deploy 
* If Jar file is provided, use Run From Zip 
* For all others, use Run From Package (via Zip Deploy) 

On non-Windows agent (for any App service type), the task relies on [Kudu REST APIs](https://github.com/projectkudu/kudu/wiki/REST-API) to deploy the Web App.


### [Kudu REST APIs](https://github.com/projectkudu/kudu/wiki/REST-API)
Works on a Windows as well as Linux automation agent when the target is an Azure Function app on Windows or an Azure Function App on Linux (built-in source). The task uses Kudu to copy over files to the Azure Functions App.

### Zip Deploy
Creates a .zip deployment package of the chosen Package or folder and deploys the file contents to the wwwroot folder of the App Service name function app in Azure. This option overwrites all existing contents in the wwwroot folder. For more information, see [Zip deployment for Azure Functions](https://docs.microsoft.com/azure/azure-functions/deployment-zip-push).

### RunFromPackage
Creates the same deployment package as Zip Deploy. However, instead of deploying files to the wwwroot folder, the entire package is mounted by the Functions runtime. With this option, files in the wwwroot folder become read-only. For more information, see [Run your Azure Functions from a package file](https://docs.microsoft.com/azure/azure-functions/run-functions-from-deployment-package).

### Parameters of the task
The task is used to deploy a Web  project to an existing Azure Function. The mandatory fields are highlighted with a *.

* **Azure Subscription\*:** Select the AzureRM Subscription. If none exists, then click on the **Manage** link, to navigate to the Services tab in the Administrators panel. In the tab click on **New Service Endpoint** and select **Azure Resource Manager** from the dropdown.

* **App type\*:** Select the Azure Function type. The different app types supported are Function App on Windows or Function App on Linux.

* **Azure Function App Name\*:** Select the name of an existing Azure Function App. Enter the name of the Function App if it was provisioned dynamically using the [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell) and [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx).

* **Deploy to Slot:** Select the option to deploy to an existing slot other than the Production slot. Do not select this option if the Web project is being deployed to the Production slot. The Function App itself is the Production slot.

* **Resource Group:** Select the Azure Resource Group that contains the Azure Function App specified above. Enter the name of the Azure Resource Group if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/DeployAzureResourceGroup) or [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell). This is a required parameter if the option to Deploy to Slot has been selected.

* **Slot:** Select the Slot to deploy the Function project to. Enter the name of the Slot if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/DeployAzureResourceGroup) or [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell). This is a required parameter if the option to Deploy to Slot has been selected.

* **Package or Folder\*:** Location of the Function App zip package or folder on the automation agent or on a UNC path accessible to the automation agent like, \\\\BudgetIT\\Web\\Deploy\\Fabrikam.zip. Predefined system variables and wild cards like, $(System.DefaultWorkingDirectory)\\\***.zip can be also used here.

* **Select deployment method:** Select the option to choose from  auto, zipDeploy and runFromPackage. Default value is Auto-detect where the task tries to select the appropriate deployment technology given the input package, app service type and agent OS.

* **Runtime Stack:**
Function App on Linux offers you an option to configure App deployment with a built-in platform image (Function App on Linux). You will see this parameter only when you selected 'Function App on Linux' in the App type selection option in the task.
  
For App Type **Function on Linux** you need to provide the following details:
* *Runtime stack:* Select the framework and version your web app will run on.
  
* *Application and Configuration Settings*

**App settings**: [App settings](https://docs.microsoft.com/en-us/azure/app-service/web-sites-configure#app-settings) contains name/value pairs that your web app will load on start up. Edit web app application settings by following the syntax '-key value'. Value containing spaces should be enclosed in double quotes.
>Example : -Port 5000 -RequestTimeout 5000 
>-WEBSITE_TIME_ZONE "Eastern Standard Time"



### FAQ
* To ignore SSL error set a Variable of name VSTS_ARM_REST_IGNORE_SSL_ERRORS with value : true in the release definition.
* The task works with the [Azure Resource Manager APIs](https://msdn.microsoft.com/en-us/library/azure/dn790568.aspx) only.
* For avoiding deployment failure with error code ERROR_FILE_IN_USE we recommend defaulting to using the Run From Package option [Run your functions from a package file in Azure](https://docs.microsoft.com/en-us/azure/azure-functions/run-functions-from-deployment-package). For zero downtime deployment use slot swap.

