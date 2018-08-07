# Visual Studio Team Services Tasks
![Tasks](/taskbanner.png "Tasks")

## Overview
This repo contains the tasks that are provided out-of-the-box with Visual Studio Team Services and Team Foundation Server.

This provides open examples on how we write tasks which will help you write other tasks which can be uploaded to your account or server.  See **Writing Tasks** below.

## Status
|   | Build & Test |
|---|:-----:|
|![macOS](docs/res/apple_med.png) **macOS**|![Build & Test](https://mseng.visualstudio.com/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/4213/badge?branch=master)| 
|![Ubuntu14](docs/res/ubuntu_med.png) **Ubuntu 14.04**|![Build & Test](https://mseng.visualstudio.com/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/4088/badge?branch=master)|
|![Win](docs/res/win_med.png) **Windows**|![Build & Test](https://mseng.visualstudio.com/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/1474/badge?branch=master)|

## How to Use Tasks

See the documentation for [Continuous integration and deployment](https://aka.ms/tfbuild).

## Writing Tasks

If you need custom functionality in your build/release, it is usually simpler to use the existing script running tasks such as the PowerShell or Shell Script tasks.  Writing a new task may be appropriate if you need deeper integration or reusability in many build definitions

Tasks are simply tool runners.  They know how to run MSBuild, VSTest, etc... in a first class way and handle return codes, how to treat std/err out, and how to write timeline records based on expected output.  They also get access to credentials to write back to TFS/Team Services. 

For uploading custom tasks to VSTS use the [TFS Cross Platform Command Line utility](https://github.com/Microsoft/tfs-cli).

Tasks can also be deployed with a Visual Studio Team Services extension. See [this tutorial](https://docs.microsoft.com/en-us/vsts/extend/develop/add-build-task) for how to package tasks inside an extension.

## Contributing
We take contributions.  [Read here](docs/contribute.md) how to contribute.
