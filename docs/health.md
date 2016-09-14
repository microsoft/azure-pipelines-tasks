# Tasks Health Report

Since the tasks are open-sourced as reference examples, we want to ensure they follow the task guidelines.
Use the reports below when looking for a task as a reference example.

# Guidelines

## Implemented
  - Tasks should have one implementation.
  - Written in TypeScript (compiled) or PowerShell
  - Tasks and the modules they use are open source

## Platform-complete
  - Tasks should be able to drive their technology on all the platforms they support
  - Tasks driving cross-platform technologies should be written cross-platform (TypeScript)

## Uses TaskLib/SDK

Tasks should use the vsts-task-lib (TS) or vsts-task-sdk (PS).

Important! Reasons are [laid out here](https://github.com/Microsoft/vsts-task-lib/blob/master/powershell/Docs/README.md).

## Has L0 Tests

Contributors (Microsoft and public) should be able to run tests on any platform.

Per the [Contribution Guidelines](https://github.com/Microsoft/vsts-tasks/blob/master/docs/contribute.md).

# Task Health

## Build

|      Task        | Implemented | Platform-complete | Uses TaskLib/SDK | Has L0 Tests | Comments |
|------------------|------|------|------|----|----------|
| Ant                            |![Green](res/yellow.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| 2 Impl. Code Coverage only in PS1|
| AndroidSigning                 |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CMake                          |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CmdLine                        |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CocoaPods                      |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/red.png)| |
| Gradle                         |![Green](res/yellow.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| 2 Impl. Code Coverage only in PS1|
| Grunt                          | | | | | |
| Gulp                           | | | | | |
| MSBuild                        | | | | | |
| Maven                          |![Green](res/yellow.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| 2 Impl. Code Coverage only in PS1|
| VSBuild                        | | | | | |
| XamarinAndroid                 | | | |![Green](res/green.png)| |
| XamarinComponentRestore        | | | |![Green](res/green.png)| |
| XamarinLicense                 | | | |![Green](res/green.png)| |
| XamarinTestCloud               | | | |![Green](res/green.png)| |
| XamariniOS                     | | | |![Green](res/green.png)| |
| Xcode                          | | | | | |
| XcodePackageiOS                | | | | | |

## Packaging

|      Task        | Implemented | Platform-complete | Uses TaskLib/SDK | Has L0 Tests | Comments |
|------------------|------|------|------|----|----------|
| Npm                            | | | | | |
| NuGetInstaller                 | | | | | |
| NugetPackager                  | | | | | |
| NugetPublisher                 | | | | | |

## Utilities

|      Task        | Implemented | Platform-complete | Uses TaskLib/SDK | Has L0 Tests | Comments |
|------------------|------|------|------|----|----------|
| ArchiveFiles                   | | | | | |
| BatchScript                    |![Green](res/green.png)|![Green](res/green.png)| N/A  |  N/A | Carries no task impl.  Handler in agent |
| CMake                          |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CmdLine                        |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CopyFiles                      |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CopyPublishBuildArtifacts      |![Green](res/yellow.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| 2 Impl.  Pinned to PS on windows |
| cURLUploader                   |![Green](res/yellow.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| 2 Impl. PS1 should be removed|
| DecryptFile                    | | | | | |
| DeleteFiles                    |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| ExtractFiles                   |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| JenkinsQueueJob                |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| powerShell                     | | | | | |
| PublishBuildArtifacts          | | | | | |
| PublishSymbols                 | | | | | |
| ShellScript                    | | | | | |

## Test

|      Task        | Implemented | Platform-complete | Uses TaskLib/SDK | Has L0 Tests | Comments |
|------------------|------|------|------|----|----------|
| DeployVisualStudioTestAgent    | | | | | |
| QuickPerfTest                  | | | | | |
| RunDistributedTests            | | | | | |
| RunJMeterLoadTest              | | | | | |
| RunLoadTest                    | | | | | |
| SonarQubePostTest              | | | | | |
| SonarQubePreBuild              | | | | | |

## Deploy 


|      Task        | Implemented | Platform-complete | Uses TaskLib/SDK | Has L0 Tests | Comments |
|------------------|------|------|------|----|----------|
| AzureCloudPowerShellDeployment | | | | | |
| AzureFileCopy                  | | | | | |
| AzurePowerShell                |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| AzureRmWebAppDeployment        | | | | | |
| AzureWebPowerShellDeployment   | | | | | |
| Chef                           | | | | | |
| ChefKnife                      | | | | | |
| DeployAzureResourceGroup       | | | | | |
| IISWebAppDeployment            | | | | | |
| PowerShellOnTargetMachines     | | | | | |
| SqlAzureDacpacDeployment       | | | | | |
| SqlServerDacpacDeployment      | | | | | |
| WindowsMachineFileCopy         | | | | | |
