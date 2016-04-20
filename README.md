![VSTS] (https://mseng.visualstudio.com/DefaultCollection/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/1474/badge)

# Visual Studio Team Services Tasks
<br/>
![Tasks](/taskbanner.png?raw=true "Tasks")
<br/>

## Overview
This repo contains the tasks that are provided out of the box with Visual Studio Team Services and Team Foundation Server.

This provides open examples on how we write tasks which will help you write other tasks which can be uploaded to your account or server.  See writing tasks below.

## How to Use Tasks

[Documentation is here](http://aka.ms/tfbuild)

## Writing Tasks

Before writing a task, consider simply customizing your build using the script running tasks such as PowerShell or shell scripts.  That is often the most appropriate path.

Tasks are simply tool runners.  They know how to run MSBuild, VSTest, etc... in a first class way and handle return codes, how to treat std/err out, and how to write timeline records based on expected output.  They also get access to credentials to write back to VSO/TFS. 

For uploading custom tasks to VSTS use the [TFS Cross Platform Command Line utility](https://github.com/Microsoft/tfs-cli).

Tasks can also be deployed with an Visual Studio Team Service Extension. See [this tutorial](https://www.visualstudio.com/en-us/integrate/extensions/develop/add-build-task) how to package tasks inside an extension.

## Contributing
We take contributions.  [Read here](docs/contribute.md) how to contribute.
