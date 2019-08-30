#  Azure App Service Settings

## Overview

The Azure App Service Settings task is used to update different Azure App Service settings for [Web Apps](https://azure.microsoft.com/en-in/documentation/articles/app-service-web-overview/). The task works on cross platform Azure Pipelines agents running Windows, Linux or Mac.

The task is **under development and is available to a limited set of Azure DevOps organizations**.

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The following pre-requisites need to be setup in the target machine(s) for the task to work properly.

##### Azure Web App or Azure Function

The task is used to update different Azure App Service settings for existing Azure Web App. The Web App should exist prior to running the task. The Web App can be created from the [Azure portal](https://azure.microsoft.com/en-in/documentation/videos/azure-app-service-web-apps-with-yochay-kiriaty/) and [configured](https://azure.microsoft.com/en-us/documentation/articles/web-sites-configure/) there. Alternatively, the [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell) can be used to run [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx) to provision and configure the Web App.


##### Azure Subscription

To update different Azure App Service settings, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.

Create the [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/) service endpoint, use **'Azure Resource Manager'** endpoint type, for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

The task does not work with the Azure Classic service endpoint and it will not list these connections in the parameters in the task.

### [Kudu REST APIs](https://github.com/projectkudu/kudu/wiki/REST-API)
Works on a Windows as well as Linux automation agent when the target is a Web App on Windows or Web App on Linux (built-in source) or Function App. The task uses Kudu to copy over files to the Azure App service.

### Parameters of the task
The task is used to deploy a Web  project to an existing Azure Web App or Function. The mandatory fields are highlighted with a *.

* **Azure Subscription\*:** Select the AzureRM Subscription. If none exists, then click on the **Manage** link, to navigate to the Services tab in the Administrators panel. In the tab click on **New Service Endpoint** and select **Azure Resource Manager** from the dropdown.

* **App Service Name\*:** Select the name of an existing Azure App Service. Enter the name of the Web App if it was provisioned dynamically using the [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell) and [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx).

* **Resource Group:** Select the Azure Resource Group that contains the Azure App Service specified above. Enter the name of the Azure Resource Group if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/DeployAzureResourceGroup) or [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell). This is a required parameter if the option to Deploy to Slot has been selected. However, Resource Group is an optional field for YAML. 

* **Slot:** Select the option to change settings of an existing slot other than the Production slot. Do not select this option if the changes are to be made to the Production slot. The Web App itself is the Production slot.

* **Application and Configuration Settings**

[Configure an App Service app](https://docs.microsoft.com/en-us/azure/app-service/configure-common)

**App settings**: [App settings](https://docs.microsoft.com/en-us/azure/app-service/web-sites-configure#app-settings) contains name/value pairs that your web app will load on start up. Edit web app application settings by following the syntax :
>Example:
[
   {
    "name": "key1", 
    "value": "valueabcd",
    "slotSetting": false 
   },
   {
    "name": "key2", 
    "value": "valueefgh",
    "slotSetting": true 
   }
]

**General settings**:
Edit web app [General settings](https://docs.microsoft.com/en-us/azure/app-service/configure-common?toc=%2fazure%2fapp-service%2fcontainers%2ftoc.json#configure-general-settings) following the syntax -key value. Value containing spaces should be enclosed in double quotes.
>Example :
[
   {
    "alwaysOn": true, 
    "webSocketsEnabled": false
   }
]

**Connection Strings**: [Connection Strings](https://docs.microsoft.com/en-us/azure/app-service/configure-common?toc=%2fazure%2fapp-service%2fcontainers%2ftoc.json#configure-connection-strings) contains name/value pairs that your web app will load on start up. Edit web app application settings by following the syntax :
>Example :
[
   {
    "name": "key1", 
    "value": "valueabcd",
    "type": "MySql", 
    "slotSetting": false 
   },
   {
    "name": "key2", 
    "value": "valueefgh",
    "type": "Custom", 
    "slotSetting": true 
   }
]

### YAML snippet

```
steps:
- task: AzureAppServiceSettings@1
  displayName: 'Azure App Service Settings: demo_webapp'
  inputs:
    azureSubscription: demo_subscription_id
    appName: demo_webapp
    appSettings: |
     [ { "name": "key1", "value": "valueabcd", "slotSetting": false }, { "name": "key2", "value": "valueefgh", "slotSetting": true } ]
    generalSettings: |
     [ { "alwaysOn": true, "webSocketsEnabled": false } ]
    connectionStrings: |
     [ { "name": "key1", "value": "valueabcd", "type": "MySql", "slotSetting": false }, { "name": "key2", "value": "valueefgh", "type": "Custom", "slotSetting": true } ]
```