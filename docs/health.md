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
    <td bgcolor="silver">Azure Powershell</td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="white">Tested in Azure-CommonHelpers</td>
  </tr>
  <tr>
    <td bgcolor="silver">CMake</td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="white"></td>
  </tr>
  <tr>
    <td bgcolor="silver">BatchScript</td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="white">N/A</td>
    <td bgcolor="white">N/A</td>
    <td bgcolor="white">No task impl because run as handler</td>
  </tr>
  <tr>
    <td bgcolor="silver">CmdLine</td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="white"></td>
  </tr>
  <tr>
    <td bgcolor="silver">CocoaPods</td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="red"></td>
    <td bgcolor="white"></td>
  </tr>
  <tr>
    <td bgcolor="silver">CopyFiles</td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="white"></td>
  </tr>
  <tr>
    <td bgcolor="silver">CopyPublishBuildArtifacts</td>
    <td bgcolor="yellow"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="red"></td>
    <td bgcolor="white">Written in TS but windows pinned to PS</td>
  </tr>
  <tr>
    <td bgcolor="silver">DeleteFiles</td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="green"></td>
    <td bgcolor="white"></td>
  </tr>
</table>