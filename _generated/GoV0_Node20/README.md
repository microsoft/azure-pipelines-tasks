#  Go - Get, Build, or Test a Go Lang application
 
## Overview
 
The Go task can be used to fetch Go dependencies, build Go packages, test Go packages, or run a custom Go command using Go Tool.
 
## Contact Information
 
If you have a problem using this task, report it at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html). In addition, go there to share feedback about the task and the new features you would like to see.
 
## Pre-requisites for the task
 
The only pre-requisite for this task is that Go Tool must be installed on the Azure Pipelines agent (hosted or private) machine. To specify the version of Go Tool to be installed on the agent, use Go Tool Installer Task.
  
### Parameters of the task
 
* **Command\*:** Select a Go command to run. Select 'Custom' to use a command not shown in the list.
 
* **Arguments:** Pass arguments to the selected Go command. For example, build arguments for go build command.
 
* **Working Directory:** Current working directory where the Go command is executed. Wildcards can be used. Default path is repository root $(System.DefaultWorkingDirectory).
 
Options specific to **Custom** command
 
* **Custom command\*:** Enter a custom Go command that is not available in the 'Command' list. For example, to execute go version, enter `version`.

