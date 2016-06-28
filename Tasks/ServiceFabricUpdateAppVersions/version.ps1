# For more information on the VSTS Task SDK:
# https://github.com/Microsoft/vsts-task-lib

[CmdletBinding()]
param()

function Assert-SingleItem
{
    Param (
        $Items,
        
        [String]
        $Pattern
    )
    
    if (@($Items).Length -gt 1) 
    {
        throw (Get-VstsLocString -Key ItemSearchMoreThanOneFound -ArgumentList $Pattern) 
    }
    elseif ($Items -eq $null -or @($Items).Length -eq 0)
    {
        throw (Get-VstsLocString -Key ItemSearchNoFilesFound -ArgumentList $Pattern) 
    }
}

Trace-VstsEnteringInvocation $MyInvocation
try {
    # Import the localized strings. 
    Import-VstsLocStrings "$PSScriptRoot\task.json"
    
    # Collect input values
    $applicationPackagePathSearchPattern = Get-VstsInput -Name applicationPackagePath -Require
    Write-Host (Get-VstsLocString -Key SearchingForApplicationPackage -ArgumentList $applicationPackagePathSearchPattern)
    $applicationPackagePath = Find-VstsFiles -LegacyPattern $applicationPackagePathSearchPattern -IncludeDirectories
    Assert-SingleItem $applicationPackagePath $applicationPackagePathSearchPattern
    Assert-VstsPath -LiteralPath $applicationPackagePath -PathType Container
    Write-Host (Get-VstsLocString -Key FoundApplicationPackage -ArgumentList $applicationPackagePath)
    
    $versionSuffix = Get-VstsInput -Name versionSuffix -Require
    Write-Host "versionSuffix: $versionSuffix"
    
    # Update app manifest
    $appManifestPath = "$applicationPackagePath\ApplicationManifest.xml"
    $appManifestXml = [XML](Get-Content $appManifestPath)
    $appManifestXml.ApplicationManifest.ApplicationTypeVersion += $versionSuffix
    $appManifestXml.ApplicationManifest.ServiceManifestImport | ForEach { $_.ServiceManifestRef.ServiceManifestVersion += $versionSuffix }
    $appManifestXml.Save($appManifestPath)

    Write-Host (Get-VstsLocString -Key UpdatedApplicationTypeVersion -ArgumentList @($appManifestXml.ApplicationManifest.ApplicationTypeName, $appManifestXml.ApplicationManifest.ApplicationTypeVersion))

    # Update each service manifest
    $serviceManifestPaths = Find-VstsFiles -LiteralDirectory $applicationPackagePath -LegacyPattern "**\ServiceManifest.xml"
    $serviceManifestPaths | ForEach {
        $serviceManifestXml = [XML](Get-Content $_)
        $serviceManifestXml.ServiceManifest.Version += $versionSuffix
        $subPackages = @(
            $serviceManifestXml.ServiceManifest.CodePackage,
            $serviceManifestXml.ServiceManifest.ConfigPackage,
            $serviceManifestXml.ServiceManifest.DataPackage)
        $subPackages | Where { $_.Version } | ForEach { $_.Version += $versionSuffix }
        $serviceManifestXml.Save($_)
    
        Write-Host (Get-VstsLocString -Key UpdatedServiceVersion -ArgumentList @($serviceManifestXml.ServiceManifest.Name, $serviceManifestXml.ServiceManifest.Version))
    }
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}