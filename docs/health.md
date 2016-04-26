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

<table class="tg">
  <tr>
    <th></th>
    <th>Impl</th>
    <th>Plat</th>
    <th>Libs</th>
    <th>L0</th>
    <th>Comments</th>
  </tr>
  <tr>
    <td>Azure Powershell</td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td bgcolor="white">Tested in Azure-CommonHelpers</td>
  </tr>
  <tr>
    <td>CMake</td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td bgcolor="white"></td>
  </tr>
  <tr>
    <td>BatchScript</td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td>N/A</td>
    <td>N/A</td>
    <td bgcolor="white">No task impl because run as handler</td>
  </tr>
  <tr>
    <td>CmdLine</td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td bgcolor="white"></td>
  </tr>
  <tr>
    <td>CocoaPods</td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/red.png"/></td>
    <td bgcolor="white"></td>
  </tr>
  <tr>
    <td>CopyFiles</td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td bgcolor="white"></td>
  </tr>
  <tr>
    <td>CopyPublishBuildArtifacts</td>
    <td><img src="res/yellow.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/red.png"/></td>
    <td bgcolor="white">2 Impl.  Written in TS but windows pinned to PS</td>
  </tr>
  <tr>
    <td>DeleteFiles</td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td><img src="res/green.png"/></td>
    <td bgcolor="white"></td>
  </tr>
</table>