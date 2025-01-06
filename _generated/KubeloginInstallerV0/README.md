#  Kubelogin Installer

## Overview

The Kubelogin Installer task acquires a specific version of [Kubelogin](https://azure.github.io/kubelogin/index.html) from internet or the tools cache and adds it to the PATH of the Azure Pipelines Agent (hosted or private). Use this task to change the version of Kubelogin used in subsequent tasks like [KubernetesManifestV1](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/KubernetesManifestV1), [HelmDeployV0](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/HelmDeployV0), [AzureFunctionOnKubernetesV1](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/AzureFunctionOnKubernetesV1), [KubernetesV1](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/KubernetesV1).
Adding this task before those tasks in a build definition ensures that the version will be available at the time of  building, testing and publishing your app.

The tool installer approach also allows you to decouple from the agent update cycles. If the Kubelogin version you are looking for is missing from the Azure Pipelines agent (Hosted or Private), then you can use this task to get the right version installed on the agent.

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

### Parameters of the task

* **Version\*:** Specify version of Kubelogin to install. Default value is `latest`. See below for examples:
  * To install 0.0.30, use `0.0.30`

    For more details about the versions, see [Kubelogin Release Page](https://github.com/Azure/kubelogin/releases).
