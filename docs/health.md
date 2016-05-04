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

|      Task        | Implemented | Platform-complete | Uses TaskLib/SDK | Has L0 Tests | Comments |
|------------------|------|------|------|----|----------|
| Ant                            | | | | | |
| AndroidSigning                 | | | | | |
| AzureCloudPowerShellDeployment | | | | | |
| AzureFileCopy                  | | | | | |
| AzurePowerShell                |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| AzureRmWebAppDeployment        | | | | | |
| AzureWebPowerShellDeployment   | | | | | |
| BatchScript                    |![Green](res/green.png)|![Green](res/green.png)| N/A  |  N/A | Carries no task impl.  Handler in agent |
| CMake                          |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| Chef                           | | | | | |
| ChefKnife                      | | | | | |
| CmdLine                        |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CocoaPods                      |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/red.png)| |
| CopyFiles                      |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| CopyPublishBuildArtifacts      |![Green](res/yellow.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| 2 Impl.  Pinned to PS on windows |
| cURLUploader                   | | | | | |
| DecryptFile                    | | | | | |
| DeleteFiles                    |![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)|![Green](res/green.png)| |
| DeployAzureResourceGroup       | | | | | |
| DeployVisualStudioTestAgent    | | | | | |
| Gradle                         | | | | | |
| Grunt                          | | | | | |
| Gulp                           | | | | | |
| IISWebAppDeployment            | | | | | |
| MSBuild                        | | | | | |
| Maven                          | | | | | |
| Npm                            | | | | | |
| NuGetInstaller                 | | | | | |
| NugetPackager                  | | | | | |
| NugetPublisher                 | | | | | |
| powerShell                     | | | | | |
| PowerShellOnTargetMachines     | | | | | |
| PublishBuildArtifacts          | | | | | |
| PublishCodeCoverageResults     | | | | | |
| PublishSymbols                 | | | | | |
| PublishTestResults             | | | | | |
| QuickPerfTest                  | | | | | |
| RunDistributedTests            | | | | | |
| RunJMeterLoadTest              | | | | | |
| RunLoadTest                    | | | | | |
| ShellScript                    | | | | | |
| SonarQubePostTest              | | | | | |
| SonarQubePreBuild              | | | | | |
| SqlAzureDacpacDeployment       | | | | | |
| SqlServerDacpacDeployment      | | | | | |
| VSBuild                        | | | | | |
| VsTest                         | | | | | |
| WindowsMachineFileCopy         | | | | | |
| XamarinAndroid                 | | | | | |
| XamarinComponentRestore        | | | | | |
| XamarinLicense                 | | | | | |
| XamarinTestCloud               | | | | | |
| XamariniOS                     | | | | | |
| Xcode                          | | | | | |
| XcodePackageiOS                | | | | | |
