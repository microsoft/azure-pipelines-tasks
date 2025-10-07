# Azure App Configuration Import

### Overview

This task is used to import key-values from a configuration file to your [App Configuration store](https://learn.microsoft.com/azure/azure-app-configuration/quickstart-azure-app-configuration-create). 

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

* **App Configuration Endpoint**\*: Select the endpoint of the App Configuration store to which the key-values will be imported to.

* **Configuration File Path**\*: Provide the path to your configuration file.

* **File Content Profile**\*: Provide the Configuration File's [content profile](https://learn.microsoft.com/azure/azure-app-configuration/concept-config-file). Default value is **Default**.
    - **Default**: Refers to the conventional configuration file formats that are directly consumable by applications.
    - **KVSet**:  Refers to a [file schema](https://github.com/Azure/AppConfiguration/blob/main/docs/KVSet/KVSet.v1.0.0.schema.json) that contains all properties of an App Configuration key-value

* **Import Mode**\*: Provide the import mode. The default value is **Ignore Match**.
    - **All**:  Imports all key-values in the configuration file to App Configuration.
    - **Ignore Match**: Imports only settings that have no matching key-value in App Configuration. Matching key-values are considered to be key-values with the same key, label, value, content type and tags.

* **Dry Run**: Default value is **Unchecked**
    - **Checked**: No updates will be performed to App Configuration. Instead any updates that would have been performed in a normal run will be printed to the console for review.
    - **Unchecked**: Performs any updates to App Configuration and does not print to the console.

* **Separator**: Provide the separator that should be used to flatten .json and .yml files.

* **Depth**: Provide the depth that the .json and .yml files will be flattened to.

* **Prefix**: Provide a string that will be appended to the beginning of each key imported to App Configuration Store.

* **Label**: Provide a string that is added to each key-values as the label within the App Configuration Store.

* **Content Type**: Provide a string that is added to each key-value as the content type within the App Configuration store.

* **Exclude feature flags**: Specify whether or not any feature flags provided in the configuration file will be imported to App Configuration.

* **Use the file path extension to determine the file format**: Specify whether or not to use the file path extension to determine the file format.

* **Delete key-values that are not included in the configuration file**: The behavior of this option depends on the configuration file [content profile](https://learn.microsoft.com/azure/azure-app-configuration/concept-config-file). Default value is **Unchecked**.
    - **Unchecked**:  Imports all key-values from the configuration file into the App Configuration store and leaves everything else in the App Configuration store intact
    - **Checked**:
        - **Default content profile**: Removes all key-values in the App Configuration store that match both the specified prefix and label before importing new key-values from the configuration file
        - **Kvset content profile**: Removes all key-values in the App Configuration store that are not included in the configuration file before importing new key-values from the configuration file.

* **Tags**: Specify one or more tags that should be added to a key-value. Tags should be of a valid JSON format.


