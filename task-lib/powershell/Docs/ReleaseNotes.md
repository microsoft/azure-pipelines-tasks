# Release Notes

## 0.21.0

- Added audit action for task.issue [#1033](https://github.com/microsoft/azure-pipelines-task-lib/pull/1033)

## 0.17.0

* Added `Invoke-VstsProcess` cmdlet (<https://github.com/microsoft/azure-pipelines-task-lib/pull/978>)

## 0.16.0
* Replaced deprecated "sync-request" libraryr and Added new async methods for DownloadArchive

## 0.15.0
* Removed the `Q` library

## 0.14.0
* Improved error handling in function `Find-Files`

## 0.13.0
* Added parameter `IgnoreHostException` for function `Invoke-Tool` to suppress `System.Management.Automation.Host.HostException`

## 0.12.0
* Fixed issue when Find-Match in powershell does not support searching a pattern in a path that does not exist (#365)
* Resolved issue with loading `Newtonsoft.Json.dll`
* Made `Write-LoggingCommand` exported

## 0.11.0
* Added input functions `Get-SecureFileTicket` and `Get-SecureFileName`.
* Added missing agent commands.

## 0.10.0
* Updated `Get-VstsVssHttpClient`. Added `-WebProxy` parameter. `Get-VstsVssHttpClient` will follow agent proxy setting by default.
* Added `Get-VstsWebProxy` to retrieve agent proxy settings.

## 0.9.0
* Breaking change for `Select-VstsMatch` due to positional parameter changes and partial parameter name impact.
* Updated `Select-VstsMatch`. Added `-PatternRoot` parameter.
* Added `Assert-VstsAgent`.

## 0.8.2
* Fixed issue with env block size limit.

## 0.8.0
* Added `Find-VstsMatch` and `Select-VstsMatch` for finding files with advanced pattern matching.

## 0.7.1
* Updated `Find-VstsFiles` to fix error when traversing files with IntegrityStream, Virtual, or NoScrubData attribute.

## 0.7.0
* Breaking changes for `Get-VstsTfsClientCredentials` and `Get-VstsVssCredentials`. See [Using the VSTS REST SDK and TFS Extended Client SDK](UsingOM.md).
* Added `Get-VstsTfsService` and `Get-VstsVssHttpClient`.
* Added `Get-VstsTaskVariableInfo` to get all task variables, secret and non-secret.

## 0.6.4
* Updated `Get-VstsTfsClientCredentials` to fix authentication bugs.

## 0.6.3
* Updated `Find-VstsFiles` to fix `-IncludeDirectories` functionality.
* Updated initialization (`Invoke-VstsTaskScript`) to remove secret variables from the environment drive. The variables are stored within the module as `PSCredential` objects. `Get-VstsTaskVariable` has been updated to retrieve the internally stored secret variables and return the plain values. Otherwise `Get-VstsTaskVariable` falls back to checking for the variable as a non-secret variable on the environment drive.

## 0.6.2
* Updated initialization (`Invoke-VstsTaskScript`) to run within the global session state. Modules imported by the task script will now be imported into the global session state.

## 0.6.1
* Updated initialization (`Invoke-VstsTaskScript`) to globally set `ErrorActionPreference` to `Stop`.
* Updated initialization (`Invoke-VstsTaskScript`) to remove input and endpoint variables from the environment drive. The variables are stored within the module as `PSCredential` objects. `Get-VstsInput` and `Get-VstsEndpoint` have been updated to retrieve the internally stored variables and return the plain values.
* Updated `Invoke-VstsTool`. The command line being invoked is now written to the host stream.
* Added `Write-VstsSetSecret`.

## 0.6.0
* Updated `Get-VstsEndpoint`. Added a `Data` property to the endpoint object.
* Updated `Write-VstsSetVariable`. Added a `Secret` switch.
* Added `Write-VstsAddBuildTag`.

## 0.5.4
* Loc string updates for TFS 2015 Update 2.

## 0.5.1
* Updated `Write-VstsAssociateArtifact`. Added a mandatory `Type` parameter. Added an optional `Properties` parameter so that additional properties can be stored on an artifact.

## 0.5.0
* Initial release.
