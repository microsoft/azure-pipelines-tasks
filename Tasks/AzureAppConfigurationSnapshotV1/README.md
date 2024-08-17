# Azure AppConfiguration Snapshot

### Overview

This task is used for creating [snapshots](https://learn.microsoft.com/azure/azure-app-configuration/concept-snapshots) in a given [App Configuration store](https://learn.microsoft.com/en-us/azure/azure-app-configuration/quickstart-azure-app-configuration-create). A snapshot is a named, immutable subset of an App Configuration store's key-values. The task is node based and works on cross platform Azure Pipelines agents running Windows, Linux or Mac.

## Contact Information

Please report a problem to [AzureAppConfig@microsoft.com](AzureAppConfig@microsoft.com) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

### Parameters of the task:

The parameters of the task are described below. The parameters listed with a \* are required parameters for the task:

* **Azure Subscription**\*: Select the AzureRM Subscription. If none exists, then click on the **Manage** link, to navigate to the Services tab in the Administrators panel. In the tab click on **New Service Connection** and select **Azure Resource Manager** from the dropdown.

* **App Configuration Endpoint**\*: Select the endpoint of the App Configuration store to which the snapshot will be created.

* **Snapshot name**\*: Provide the name of the snapshot

* **Composition Type**\*: Select the **composition type**. 
    - **Key** composition type, if your store has identical keys with different labels, only the key-value specified in the last applicable filter is included in the snapshot. Identical key-values with other labels are left out of the snapshot.

    - **Key-Label** composition type, if your store has identical keys with different labels, all key-values with identical keys but different labels are included in the snapshot depending on the specified filters.

* **Filters**\*: Provide snapshot filters that represent the key and label filters used to build an App Configuration snapshot. Filters should be of a valid JSON format.     
    Example
    ```json
        [{\"key\":\"abc*\", \"label\":\"1.0.0\"}]

* **Retention Period**: Specify the days to retain an archived snapshot. Archived snapshots can be recovered during the retention period

* **Tags**: Specify one or more tags that should be added to a snapshot. Tags should be of a valid JSON format.


