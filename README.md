
# Azure Pipelines Task SDK

Libraries for writing [Azure Pipelines](https://azure.microsoft.com/en-us/services/devops/pipelines/) tasks

Reference examples of our in the box tasks [are here](https://github.com/microsoft/azure-pipelines-tasks)

## Status

|   | Build & Test |
|---|:-----:|
|![Win-x64](res/win_med.png) **Windows**|[![Build & Test][win-build-badge]][build]| 
|![macOS](res/apple_med.png) **macOS**|[![Build & Test][macOS-build-badge]][build]| 
|![Linux-x64](res/ubuntu_med.png) **Linux**|[![Build & Test][linux-build-badge]][build]|

[win-build-badge]: https://dev.azure.com/mseng/PipelineTools/_apis/build/status/azure-pipelines-task-lib-ci?branchName=master&jobname=windows
[macOS-build-badge]: https://dev.azure.com/mseng/PipelineTools/_apis/build/status/azure-pipelines-task-lib-ci?branchName=master&jobname=macOS
[linux-build-badge]: https://dev.azure.com/mseng/PipelineTools/_apis/build/status/azure-pipelines-task-lib-ci?branchName=master&jobname=linux
[build]: https://dev.azure.com/mseng/PipelineTools/_build/latest?definitionId=7623

## Highlights

 * __Breaks coupling with agent:__  This lib is decoupled and ships with the task and the agent is just an engine to run tasks.
 * __Testability:__ Aims to offer the ability to actually run your task scripts under all scenarios without a server or an agent.
 * __Localization:__ The lib provides a mechanism for storing your localized strings with your task, and loading the correct set at run-time.
 * __Consistent API:__ The TypeScript and PowerShell libs are largely consistent. They only differ where it makes sense (being true to the platform).
 * __Tracing for free:__ Tracing has been built-in to many of the commands. Use the SDK and get some debug tracing for free.

## TypeScript Tasks

Cross platform tasks are written in TypeScript.  It is the preferred way to write tasks once.

[![NPM version][npm-lib-image]][npm-lib-url] ![VSTS](https://mseng.visualstudio.com/DefaultCollection/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/2553/badge)

Documentation: [Creating Node Tasks with the Typescript API](node/README.md)

## PowerShell Tasks

A task which automates Powershell technologies can be written with our Powershell SDK.  These only run on Windows.

Documentation: [PowerShell API](powershell/Docs/README.md)

## Notes on authoring Tasks

Starting from [version v2.141.0](https://github.com/Microsoft/azure-pipelines-agent/releases/tag/v2.141.0), the agent can now run on three OS architectures: x86, x64, and 32-bit ARM. When authoring a new task, you can check agent variable: `Agent.OSArchitecture` (possible values: X86, X64, ARM) to restrict running said task to a particular set of OS architectures.


[npm-lib-image]: https://img.shields.io/npm/v/azure-pipelines-task-lib.svg?style=flat
[npm-lib-url]: https://www.npmjs.com/package/azure-pipelines-task-lib
[npm-sdk-image]: https://img.shields.io/npm/v/vsts-task-sdk.svg?style=flat
[npm-sdk-url]: https://www.npmjs.com/package/vsts-task-sdk

## Security issues

Do you think there might be a security issue? Have you been phished or identified a security vulnerability? Please don't report it here - let us know by sending an email to secure@microsoft.com.
