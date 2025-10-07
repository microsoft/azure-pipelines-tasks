# Azure App Configuration Export

### Overview

This task is used to export key-values from your [App configuration store](https://learn.microsoft.com/azure/azure-app-configuration/quickstart-azure-app-configuration-create) and sets them as Azure pipeline variables, which can be consumed by subsequent tasks.

## Contact Information

Please report a problem to <AzureAppConfig@microsoft.com> if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task
The following need to be set up for the task to work properly.

- Azure Subscription - [create one for free](https://azure.microsoft.com/free/)
- App Configuration store - [create one for free](https://learn.microsoft.com/azure/azure-app-configuration/quickstart-azure-app-configuration-create#create-an-app-configuration-store)
- Azure DevOps project - [create one for free](https://go.microsoft.com/fwlink/?LinkId=2014881)
- [Azure Pipelines agent version 2.144](https://github.com/microsoft/azure-pipelines-agent/releases/tag/v2.144.0) or later
- Service connection - [create a service connection](https://learn.microsoft.com/azure/azure-app-configuration/push-kv-devops-pipeline#create-a-service-connection)

### Parameters of the task:

The parameters of the task are described below. The parameters listed with a \* are required parameters for the task:

* **Azure Subscription**\*: Select the AzureRM Subscription. If none exists, then click on the **Manage** link, to navigate to the Services tab in the Administrators panel. In the tab click on **New Service Connection** and select **Azure Resource Manager** from the dropdown.

* **App Configuration Endpoint**\*: Select the endpoint of the App Configuration store to which the key-values will be exported from.

* **Selection Mode**\*: Provide the selection mode. Selection mode allows you to specify how key-values are to be selected from the configuration store. The default value is **Default**
    - **Default**: Allows the use of key and label filter to specify key-values that will be selected from the store.
    - **Snapshot**: Allows key-values to be selected from a snapshot.

* **Key Filter**: Provide the key filter that can be used when selecting key-values from the App Configuration store. A value of \* will select all key-values.

* **Label**: Provide the label filter that can be used when selecting key-values from the App Configuration store. If no label is provided, then key-values with no label will be retrieved.

* **Snapshot Name**: Provide the snapshot from which key-values should be retrieved in Azure App Configuration.

* **Trim Key Prefix**: Specify one or more prefixes that should be trimmed from the App Configuration keys before setting them as variables. Multiple prefixes can be specified by separating them with a new line character.

* **Suppress Warning for Overridden Keys**: Specify whether to show warnings when existing keys are overridden. Default value is **unchecked**.



