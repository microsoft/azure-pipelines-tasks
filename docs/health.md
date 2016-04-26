# Tasks Health Report

Since the tasks are open sourced as reference examples, we want to ensure they follow the task guidelines.  Use the reports below when looking for a task as a reference example.

# Guidelines

## Implemenation
  - Tasks should have one implementation.
  - Written in Typescript (compiled) or Powershell
  - Task and Modules it uses are open source

## Platform
  - Tasks should be able to drive that technology on all the platforms it supports
  - Tasks driving cross platform technologies should be written cross platform

## Task Lib/SDK

Tasks should use the vsts-task-lib (TS) or vsts-task-sdk  

Important! Reasons are [laid out here](https://github.com/Microsoft/vsts-task-lib/blob/master/powershell/Docs/README.md)

## L0 Tests

Contributers (Microsoft and public) should be able to run tests on any platform.

Per the [Contribution Guidelines](https://github.com/Microsoft/vsts-tasks/blob/master/docs/contribute.md)

# Health Report By Area

## Build

|      Task        | Impl | Plat | Libs | L0 | Comments |
|------------------|------|------|------|----|----------|
| Azure Powershell |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CMake            |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| BatchScript      |![Green](res/green.png)|![Green](res/green.png)| N/A  |  N/A | Carries no task impl.  Handler in agent |
| CmdLine          |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CocoaPods        |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/red.png)| |
| CopyFiles        |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CopyPublishArtifact |![Green](res/yellow.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| 2 Impl.  Pinned to PS on windows |
| DeleteFiles        |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
