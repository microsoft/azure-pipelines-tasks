# Visual Studio Team Services Tasks
<br/>
![Tasks](/taskbanner.png?raw=true "Tasks")
<br/>

## Overview
This repo contains the source code for tasks that are provided out of the box with Visual Studio Team Services and Team Foundation Server.

This provides open examples on how we write tasks.  The goal of this repo is to help you write tasks, which can be uploaded to your account or server.  See writing tasks below.

Note, this is not a delivery mechanism to acquire prerelease tasks for an older server. We don't test these tasks against older servers and it may not work.

## Status
|   | Build & Test |
|---|:-----:|
|![Win](docs/res/win_med.png) **Windows**|![Build & Test](https://mseng.visualstudio.com/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/1474/badge?branch=master)| 
|![OSX](docs/res/apple_med.png) **OSX**|![Build & Test](https://mseng.visualstudio.com/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/4213/badge?branch=master)| 
|![Ubuntu14](docs/res/ubuntu_med.png) **Ubuntu 14.04**|![Build & Test](https://mseng.visualstudio.com/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/4088/badge?branch=master)|

## How to Use Tasks

[Documentation is here](https://aka.ms/tfbuild)

## Writing Tasks

Before writing a task, consider simply customizing your build using the script running tasks such as PowerShell or shell scripts.  That is often the most appropriate path.

Tasks are simply tool runners.  They know how to run MSBuild, VSTest, etc... in a first class way and handle return codes, how to treat std/err out, and how to write timeline records based on expected output.  They also get access to credentials to write back to TFS/Team Services. 

For uploading custom tasks to VSTS use the [TFS Cross Platform Command Line utility](https://github.com/Microsoft/tfs-cli).

Tasks can also be deployed with an Visual Studio Team Service Extension. See [this tutorial](https://www.visualstudio.com/en-us/docs/integrate/extensions/develop/add-build-task) how to package tasks inside an extension.

## Contributing
We take contributions.  [Read here](docs/contribute.md) how to contribute.
