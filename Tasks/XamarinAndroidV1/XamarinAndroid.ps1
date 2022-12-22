[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\Task.json"

    # Get the inputs.
    [string]$project = Get-VstsInput -Name project -Require
    [string]$target = Get-VstsInput -Name target
    [string]$configuration = Get-VstsInput -Name configuration
    [bool]$createAppPackage = Get-VstsInput -Name createAppPackage -AsBool
    [bool]$clean = Get-VstsInput -Name clean -AsBool
    [string]$outputDir = Get-VstsInput -Name outputDir
    [string]$msbuildLocationMethod = Get-VstsInput -Name msbuildLocationMethod
    [string]$msbuildLocation = Get-VstsInput -Name msbuildLocation
    [string]$msbuildVersion = Get-VstsInput -Name msbuildVersion
    [string]$msbuildArchitecture = Get-VstsInput -Name msbuildArchitecture
    [string]$msbuildArguments = Get-VstsInput -Name msbuildArguments
    [string]$jdkVersion = Get-VstsInput -Name jdkVersion
    [string]$jdkArchitecture = Get-VstsInput -Name jdkArchitecture

    # Import the helpers.
    Import-Module -Name "$PSScriptRoot\node_modules\azure-pipelines-tasks-msbuildhelpers\MSBuildHelpers.psm1"
    . $PSScriptRoot\Get-JavaDevelopmentKitPath.ps1

    # Resolve project patterns.
    $projectFiles = Get-SolutionFiles -Solution $project

    # Format the MSBuild args.
    $msBuildArguments = Format-MSBuildArguments -MSBuildArguments $msbuildArguments -Configuration $configuration
    if($target) {
        $msBuildArguments = "$msBuildArguments /t:$target"
    }
    # Build the APK file if createAppPackage is set to true
    if($createAppPackage) {
        $msBuildArguments = "$msBuildArguments /t:PackageForAndroid"
    }
    if ($outputDir) {
        $msBuildArguments = "$msBuildArguments /p:OutputPath=`"$outputDir`""
    }
    
    try {
        Assert-VstsAgent -Minimum '2.120.0'
        $javaTelemetryData = "{`"jdkVersion`":`"$jdkVersion`"}"

        Write-Host "##vso[telemetry.publish area=Tasks.CrossPlatform;feature=XamarinAndroid]$javaTelemetryData"
    } catch {
        Write-Verbose "Failed to publish java telemetry: $errors"
    }

    if ($jdkVersion -and $jdkVersion -ne "default")
    {
        $jdkPath = Get-JavaDevelopmentKitPath -Version $jdkVersion -Arch $jdkArchitecture
        Write-Verbose "adding JavaSdkDirectory: $jdkPath"
        $msBuildArguments = "$msBuildArguments /p:JavaSdkDirectory=`"$jdkPath`""

        Write-Verbose "msBuildArguments = $msBuildArguments"
    }

    $msbuildLocation = Select-MSBuildPath -Method $msbuildLocationMethod -Location $msbuildLocation -PreferredVersion $msbuildVersion -Architecture $msbuildArchitecture

    # build each project file
    Invoke-BuildTools -SolutionFiles $projectFiles -MSBuildLocation $msbuildLocation -MSBuildArguments $msBuildArguments -Clean:$clean
} finally {
     Trace-VstsLeavingInvocation $MyInvocation
}










