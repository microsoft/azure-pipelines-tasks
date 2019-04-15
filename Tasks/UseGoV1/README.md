#  Use Go 
 
## Overview
 
The Use Go task acquires a specific version of Go Tool from the Internet or tools cache and adds it to the PATH of the Azure Pipelines Agent (hosted or private). You can use this task to change the version of Go Tool used in subsequent tasks. 
 
If the targeted Go Tool version is already installed on the Azure Pipelines Agent (hosted or private), this task will skip the process of downloading and installing it again.

The task also configures the proxy settings. This will work for all commands except for `go get` commands which are dependent on the source control provider used.
 
## Contact Information
 
If you have a problem using this task, report it in [the tasks repository](https://github.com/Microsoft/azure-pipelines-tasks/issues).

## Pre-requisites for the task
 
This task can run on Windows, Linux, or Mac machines.
 
### Parameters of the task
 
* **Version\*:** Specify Go Tool version to download and install.
 
    For Example:

    To install 1.9.3, use `1.9.3`
 
    For more details about the versions, see [Go Language Release Page](https://golang.org/doc/devel/release.html).
 
* **GOPATH\*:** Specify a new value for the GOPATH environment variable if you want to modify it.
* **GOBIN\*:** Specify a new value for the GOBIN environment variable if you want to modify it.

