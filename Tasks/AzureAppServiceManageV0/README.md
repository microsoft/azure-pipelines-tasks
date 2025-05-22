#  Azure App Service Management: ARM

## Overview

The Azure App Service Management task is used to Start/Stop/Restart App Service, Swap Slot, Install Extentions, Enable [Continuous Monitoring](https://go.microsoft.com/fwlink/?linkid=859946) or Start/Stop all continuous WebJobs on an [Azure App Service](https://azure.microsoft.com/en-in/documentation/articles/app-service-web-overview/). The task works with the [Azure Resource Manager APIs](https://msdn.microsoft.com/en-us/library/azure/dn790568.aspx) only.

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The following pre-requisites need to be setup in the target machine(s) for the task to work properly.

##### Azure App Service

The task is used to manage an existing Azure App Service. The App Service should exist prior to running the task and can be created from the [Azure portal](https://azure.microsoft.com/en-in/documentation/videos/azure-app-service-web-apps-with-yochay-kiriaty/) and [configured](https://azure.microsoft.com/en-us/documentation/articles/web-sites-configure/) there. Alternatively, the [Azure PowerShell task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzurePowerShellV3) can be used to run [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx) to provision and configure the App Service.

##### Azure Subscription

An Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab. Create a service endpoint of 'Azure Resource Manager' type. For more troubleshooting guidance around endpoint creation, refer [this](https://www.visualstudio.com/en-us/docs/build/actions/azure-rm-endpoint).

For Azure MSDN accounts, one can either use a [Service Principal](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409) or a work account. It's easy to create a work account as shown below:

1. Create an user in the Azure Active Directory from the [portal](https://msdn.microsoft.com/en-us/library/azure/hh967632.aspx) (this is the old Azure portal). After adding the account, the following two things need to be done to use the organization in Azure Pipelines:
  - Add the Active Directory account to the co-administrators in the subscription. Go to the Settings and then click on administrators and add the account as a co-admin like, [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com)
  - Login to the portal with this Active Directory account wiz. [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com), and change the password. Initially a temporary password is created and that needs to be changed at the first login.
2. Add that user and password in the service connections in Azure Pipelines and deployments will work with that account.

## Parameters of the task

The task is used to manage an existing Azure App Service. The mandatory fields are highlighted with a *.

* **Azure Subscription**\*: Select the service connection for the Azure Subscription where the App Service is created. To configure new service connection, select the Azure subscription from the list and click 'Authorize'. If your subscription is not listed or if you want to use an existing Service Principal, you can setup an Azure service connection using 'Manage' link.

* **Action**\*: Select the action to be performed on the App Service. You can Start/Stop/Restart an App Service, Start/Stop all continuous WebJobs on App Service, perform a slot swap or enable [Continuous Monitoring](https://go.microsoft.com/fwlink/?linkid=859946) by using [Application Insights](https://azure.microsoft.com/en-in/services/application-insights/). The task can also be used to [install site extensions](https://www.siteextensions.net/packages) on the App Service. Site Extensions enhance your ability to manage your Azure Web Apps by allowing you to install packages like [PHP Composer](https://www.siteextensions.net/packages/ComposerExtension/) or the right version of [Python](https://www.siteextensions.net/packages?q=Python).

* **App Service Name\*:** Select the name of an existing AzureRM App Service. Enter the name of the App Service if it was provisioned dynamically using the [Azure PowerShell task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzurePowerShellV3) and [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx).

* **Resource Group:** This parameter is visible when the Action selected above is "Swap Slots" or for other actions, when "Specify slots" option is selected. Select the Azure Resource Group that contains the AzureRM App Service specified above. Enter the name of the Azure Resource Group if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzureResourceGroupDeploymentV2) or [Azure PowerShell task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzurePowerShellV3). This is a required parameter if the option to Deploy to Slot has been selected.

* **Specify Slot:** Select the option to choose an existing slot other than the Production slot. This option is available when the Action is Start/Stop/Restart an App Service.

* **Slot:** Select the Slot to target the action. Enter the name of the Slot if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzureResourceGroupDeploymentV2) or [Azure PowerShell task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzurePowerShellV3). This is a required parameter if the option to "Select Slot" has been selected when the action is Start/Stop/Restart an App Service.

* **Swap with Production:** Select the option to swap the traffic of source slot with production. If this option is not selected, then you will have to provide source and target slot names. The "Slot swap" action directs destination slot's traffic to the source slot.

* **Preserve Vnet:** Select the option to preserve the Virtual network settings

* **Resource group name for Application Insights resource:** This parameter is visible when "Enable Continuous Monitoring" action is selected. Select Azure Resource Group which contains the Application Insights resource used for enabling [Continuous Monitoring](https://go.microsoft.com/fwlink/?linkid=859946).

* **Application Insights Resource Name:** This parameter is visible when "Enable Continuous Monitoring" action is selected. Select the name of Application Insights resource where continuous monitoring data will be recorded. If your application insights resource is not listed here and you want to create a new resource, click on +new button. Once the resource is created on Azure Portal, come back here and click on refresh button.

* **Install Extensions:** The task can also be used to [install site extensions](https://www.siteextensions.net/packages) on the App Service. Site Extensions run on Microsoft Azure App Service. You can install set of tools as site extension such as [PHP Composer](https://www.siteextensions.net/packages/ComposerExtension/) or the right version of [Python](https://www.siteextensions.net/packages?q=Python). The App Service will be restarted to make sure latest changes take effect. Please note that extensions are only supported only for Web App on Windows.

## Output variable
When provided a variable name, the variable will be populated with the the local installation path of the selected extension. In case of multiple extensions selected for installation, provide comma separated list of variables that saves the local path for each of the selected extension in the order it appears in the Install Extension field. Example: outputVariable1, outputVariable2

This feature useful for setting these path values in web.config by using [Azure App Service Deployment task] (https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/AzureRmWebAppDeployment/README.md). For example: In case of Python, the output variable of Azure App Service Manage task will contain the Python installation path and then same variable will be used in  [Azure App Service Deployment task] (https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/AzureRmWebAppDeployment/README.md) to set the Python path in the web.config generated by the deploy task. You can try out this feature by selecting any Python, Nodejs, PHP release definition template.
