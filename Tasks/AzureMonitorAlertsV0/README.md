#  Azure Monitor Alerts

## Overview

The Azure Monitor Alerts task is used to add alerts on health metrics of an Azure resources. Currently this task supports adding alerts on [Application Insights](https://docs.microsoft.com/en-us/azure/application-insights/app-insights-overview), [Azure App Service](https://azure.microsoft.com/en-in/documentation/articles/app-service-web-overview/), [Azure Storage Account](https://docs.microsoft.com/en-us/azure/storage/common/storage-introduction) and Azure Virtual Machines.

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.


## Pre-requisites for the task

The following pre-requisites need to be setup in the target machine(s) for the task to work properly.

##### Azure Resource Group and Azure Resource

This task is used for adding alerts on an existing Azure Resource. The Resource Group and resource should exist prior to running this task and can be created from Azure Portal. Alternatively, the [Azure PowerShell task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzurePowerShellV3) can be used to run AzureRM PowerShell scripts to provision and configure the required Azure resource.

##### Azure Subscription

An Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab. Create a service endpoint of 'Azure Resource Manager' type. For more troubleshooting guidance around endpoint creation, refer [this](https://www.visualstudio.com/en-us/docs/build/actions/azure-rm-endpoint).

For Azure MSDN accounts, one can either use a [Service Principal](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409) or a work account. It's easy to create a work account as shown below:

1. Create an user in the Azure Active Directory from the [portal](https://msdn.microsoft.com/en-us/library/azure/hh967632.aspx) (this is the old Azure portal). After adding the account, the following two things need to be done to use the organization in Azure Pipelines:
  - Add the Active Directory account to the co-administrators in the subscription. Go to the Settings and then click on administrators and add the account as a co-admin like, [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com)
  - Login to the portal with this Active Directory account wiz. [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com), and change the password. Initially a temporary password is created and that needs to be changed at the first login.
2. Add that user and password in the service connections in Azure Pipelines and deployments will work with that account.

## Parameters of the task

The task is used to add alerts to existing Azure resource. The mandatory fields are highlighted with a *.

* **Azure Subscription**\*: Select the service connection for the Azure Subscription where the Azure resource is created. To configure new service connection, select the Azure subscription from the list and click 'Authorize'. If your subscription is not listed or if you want to use an existing Service Principal, you can setup an Azure service connection using 'Manage' link.

* **Resource Group**\*: Select the Azure Resource Group that contains the Azure resource where you want to configure alerts.

* **Resource Type**\*: Select one of the Azure resource type from the list. Currently this task supports adding alerts on [Application Insights](https://docs.microsoft.com/en-us/azure/application-insights/app-insights-overview), [Azure App Service](https://azure.microsoft.com/en-in/documentation/articles/app-service-web-overview/), [Azure Storage Account](https://docs.microsoft.com/en-us/azure/storage/common/storage-introduction) and Azure Virtual Machines. Application Insights is selected by default.

* **Resource Name**\*: Select name of Azure resource where you want to configure metric alert.

* **Alert Rules**: List of Azure monitor alerts configured on selected Azure resource. To add, remove or modify alerts, click on ... button.

  * **Alert Name**\*: Provide Display name for Azure monitor alert.

  * **Metric**: Select the resource's health metric you want to monitor.

  * **Condition**: Select condition using which your metric will be evaluated

  * **Threshold**\*: Select Threshold value for the health metric.

  * **Period**: Choose the Period of time that the metric rule must be satisfied before the alert triggers.

* **Subscription owners, contributors and readers**\*: Select this option to send email notification to everyone who has access to the resource group.

* **Additional administrator emails**\*: Add additional email addresses separated by semicolons if you want to send email notification to additional people (whether or not you checked the “subscription owners..." box).


