[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\Task.json"

    # Get the inputs.
    [string]$project = Get-VstsInput -Name project -Require
    [string]$target = Get-VstsInput -Name target
    [string]$configuration = Get-VstsInput -Name configuration
    [bool]$clean = Get-VstsInput -Name clean -AsBool
    [string]$outputDir = Get-VstsInput -Name outputDir
    [string]$msbuildLocation = Get-VstsInput -Name msbuildLocation
    [string]$msbuildArguments = Get-VstsInput -Name msbuildArguments
    [string]$jdkVersion = Get-VstsInput -Name jdkVersion
    [string]$jdkArchitecture = Get-VstsInput -Name jdkArchitecture

    # Import the helpers.
    . $PSScriptRoot\Select-MSBuildLocation.ps1
    Import-Module -Name $PSScriptRoot\ps_modules\MSBuildHelpers\MSBuildHelpers.psm1
    . $PSScriptRoot\Get-JavaDevelopmentKitPath.ps1

    # Resolve project patterns.
    $projectFiles = Get-SolutionFiles -Solution $project

    # Format the MSBuild args.
    $msBuildArguments = Format-MSBuildArguments -MSBuildArguments $msbuildArguments -Configuration $configuration
    if($target) {
        $msBuildArguments = "$msBuildArguments /t:$target"
    }
    # Always build the APK file
    $msBuildArguments = "$msBuildArguments /t:PackageForAndroid"
    if ($outputDir) {
        $args = "$args /p:OutputPath=""$outputDir"""
    }
    if ($jdkVersion -and $jdkVersion -ne "default")
    {
        $jdkPath = Get-JavaDevelopmentKitPath -Version $jdkVersion -Arch $jdkArchitecture
        if (!$jdkPath)
        {
            throw "Could not find JDK $jdkVersion $jdkArchitecture, please make sure the selected JDK is installed properly"
        }

        Write-Verbose "adding JavaSdkDirectory: $jdkPath"
        $msBuildArguments = "$msBuildArguments /p:JavaSdkDirectory=`"$jdkPath`""

        Write-Verbose "msBuildArguments = $msBuildArguments"
    }

    # Resolve the MSBuild location.
    $msbuildLocationMethod = "version"
    if($msbuildLocation) {
        $msbuildLocationMethod = "location"
    }
    $msbuildLocation = Select-MSBuildLocation -Method $msbuildLocationMethod -Location $msbuildLocation -Version "latest"

    # build each project file
    Invoke-BuildTools -SolutionFiles $projectFiles -MSBuildLocation $msbuildLocation -MSBuildArguments $msBuildArguments -Clean:$clean
} finally {
     Trace-VstsLeavingInvocation $MyInvocation
}










