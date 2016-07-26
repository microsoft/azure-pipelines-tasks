[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\Task.json"
    [string]$solution = Get-VstsInput -Name Solution -Require
    [string]$incrediBuildArgs = Get-VstsInput -Name IncrediBuildArgs
    [string]$platform = Get-VstsInput -Name Platform
    [string]$configuration = Get-VstsInput -Name Configuration
    [bool]$clean = Get-VstsInput -Name Clean -AsBool
    [string]$vsVersion = Get-VstsInput -Name VSVersion
    [string]$msBuildArchitecture = Get-VstsInput -Name MSBuildArchitecture
    [string]$IncrediBuildPath = "C:\Program Files (x86)\Xoreax\IncrediBuild\BuildConsole.exe"

    . $PSScriptRoot\Get-VSPath.ps1
    . $PSScriptRoot\Select-MSBuildLocation.ps1
    . $PSScriptRoot\Select-VSVersion.ps1
    Import-Module -Name $PSScriptRoot\ps_modules\MSBuildHelpers\MSBuildHelpers.psm1
    $VSVersion = Select-VSVersion -PreferredVersion $VSVersion
    $MSBuildLocation = Select-MSBuildLocation -VSVersion $VSVersion -Architecture $MSBuildArchitecture
    #$incrediBuildArgs = Format-MSBuildArguments -MSBuildArguments $incrediBuildArgs -Platform $Platform -Configuration $Configuration -VSVersion $VSVersion
    $global:ErrorActionPreference = 'Continue'
    Write-Host($MSBuildLocation)
    #[string]$argumentsString = "`"$solution`" /Build /Cfg=`"$configuration|$platform`" /Out `"C:\temp.log`""
    [string]$msargumentsString = "/Command=`"$MSBuildLocation `"`"$solution`"`" /p:Configuration=`"`"$configuration`"`";Platform=`"`"$platform`"`""
    [string]$outArgument = "/out=`"C:\temp.log`""
        
    if ($clean)
    {        
        $msargumentsString += " /t:Clean;Build"
        #$argumentsWithCleanString = $argumentsString + " /Clean"
    }
    $msargumentsString += "`"" #Closes the command option before continuing
    
    $msargumentsString += " " + $outArgument
    #if (!$incrediBuildArgs)
    #{
        $msargumentsString += " " + $incrediBuildArgs
    #}
    #Write-Host($argumentsString);
    Write-Host("IncrediBuild Arguments: " + $incrediBuildArgs)
    Write-Host($msargumentsString);
    Invoke-VstsTool -FileName $IncrediBuildPath -Arguments $msargumentsString -RequireExitCodeZero
    Get-Content "C:\temp.log"
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}