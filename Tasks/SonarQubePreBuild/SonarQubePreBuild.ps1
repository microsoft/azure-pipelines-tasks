[CmdletBinding()]
param()

Import-VstsLocStrings "$PSScriptRoot\Task.json"

[string]$connectedServiceName = Get-VstsInput -Name "connectedServiceName"
[string]$projectKey =  Get-VstsInput -Name "projectKey"
[string]$projectName =  Get-VstsInput -Name "projectName"
[string]$projectVersion =  Get-VstsInput -Name "projectVersion"
[string]$dbUrl =  Get-VstsInput -Name "dbUrl"
[string]$dbUsername =  Get-VstsInput -Name "dbUsername"
[string]$dbPassword =  Get-VstsInput -Name "dbPassword"
[string]$cmdLineArgs =  Get-VstsInput -Name "cmdLineArgs"
[string]$configFile =  Get-VstsInput -Name "configFile"
[bool]$includeFullReport =  Get-VstsInput -Name "includeFullReport" -AsBool
[bool]$breakBuild =  Get-VstsInput -Name "breakBuild" -AsBool

. $PSScriptRoot/Common/SonarQubeHelpers/SonarQubeHelper.ps1

# During PR builds only an "issues mode" analysis is allowed. The resulting issues are posted as code review comments. 
# The feature can be toggled by the user and is OFF by default.  
ExitOnPRBuild

. $PSScriptRoot/SonarQubePreBuildImpl.ps1

InvokePreBuildTask