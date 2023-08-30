#  .NET Core Tool Installer

## Overview

The .NET Core Tool Installer task acquires a specific version of [.NET Core](https://docs.microsoft.com/en-us/dotnet/core/tools/?tabs=netcore2x) from internet or the tools cache and adds it to the PATH of the Azure Pipelines Agent (hosted or private). Use this task to change the version of .NET Core used in subsequent tasks like [.NET Core cli task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/DotNetCoreCLIV2).
Adding this task before the [.NET Core cli task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/DotNetCoreCLIV2) in a build definition ensures you are building, testing and publishing your app with the right .NET Core version.

The tool installer approach also decouples you from the agent update cycles. If the .NET Core version you are looking for is missing from the Azure Pipelines agent (Hosted or Private), then you can use this task to get the right version installed on the agent.


## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The task can run on either Windows or Linux.

### Parameters of the task

* **Package to install\*:** You can choose to install either runtime or full SDK.

* **Version\*:** Specify exact version of .NET Core SDK or runtime to install.
Examples:
1. To install 1.0.4 SDK, use 1.0.4
2. To install 1.1.2 runtime, use 1.1.2
2. To install 2.0 preview 2 runtime, use 2.0.0-preview2-25407-01
For getting more details about exact version, refer [this link](https://github.com/dotnet/core/blob/master/release-notes/releases.csv).

