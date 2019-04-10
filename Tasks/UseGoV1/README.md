#  Go Tool Installer 
 
## Overview
 
The Go Tool Installer task acquires a specific version of Go Tool from the Internet or tools cache and adds it to the PATH of the Azure Pipelines Agent (hosted or private). You can use this task to change the version of Go Tool used in subsequent tasks. 
 
If the targeted Go Tool version is already installed on the Azure Pipelines Agent (hosted or private), this task will skip the process of downloading and installing it again.
 
## Contact Information
 
If you have a problem using this task, report it at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html). In addition, go there to share feedback about the task and the new features you would like to see.
 
## Pre-requisites for the task
 
This task can run on Windows, Linux, or Mac machines.
 
### Parameters of the task
 
* **Version\*:** Specify Go Tool version to download and install.
 
    For Example:

    To install 1.9.3, use `1.9.3`
 
    For more details about the versions, see [Go Language Release Page](https://golang.org/doc/devel/release.html).
 
* **GOPATH\*:** Specify a new value for the GOPATH environment variable if you want to modify it.
* **GOBIN\*:** Specify a new value for the GOBIN environment variable if you want to modify it.

