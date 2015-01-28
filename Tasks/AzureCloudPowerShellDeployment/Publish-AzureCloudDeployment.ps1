[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $ConnectedServiceName,

    [String] [Parameter(Mandatory = $true)]
    $ServiceName,

    [String] [Parameter(Mandatory = $true)]
    $ServiceLocation,

    [String] [Parameter(Mandatory = $true)]
    $StorageAccount,

    [String] [Parameter(Mandatory = $true)]
    $CsPkg,  #of the form **\*.cspkg (or a path right to a cspkg file, if possible)

    [String] [Parameter(Mandatory = $true)]
    $CsCfg,  #of the form **\*.cscfg (or a path right to a cscfg file, if possible)

    [String] [Parameter(Mandatory = $true)]  #default to Production
    $Slot,

    [String] [Parameter(Mandatory = $true)]
    $AllowUpgrade
)

function Get-SingleFile($files, $pattern)
{
    if($files -is [system.array])
    {
        throw "Found more than one file to deploy with search pattern $pattern.  There can be only one."
    }
    else
    {
        if(!$files)
        {
            throw "No files were found to deploy with search pattern $pattern"
        }
        return $files
    }
}

Write-Verbose "Entering script Publish-AzureCloudDeployment.ps1"

Write-Verbose "ConnectedServiceName= $ConnectedServiceName "
Write-Verbose "ServiceName= $ServiceName"
Write-Verbose "ServiceLocation= $ServiceLocation"
Write-Verbose "StorageAccount= $StorageAccount"
Write-Verbose "CsPkg= $CsPkg"
Write-Verbose "CsCfg= $CsCfg"
Write-Verbose "Slot= $Slot"
Write-Verbose "AllowUpgrade=$AllowUpgrade"

$allowUpgrade = Convert-String $AllowUpgrade Boolean

Write-Host "Find-Files -SearchPattern $CsCfg"
$serviceConfigFile = Find-Files -SearchPattern "$CsCfg"
Write-Host "serviceConfigFile= $serviceConfigFile" -ForegroundColor Yellow
$serviceConfigFile = Get-SingleFile $serviceConfigFile $CsCfg

Write-Host "Find-Files -SearchPattern $CsPkg"
$servicePackageFile = Find-Files -SearchPattern "$CsPkg"
Write-Host "servicePackageFile= $servicePackageFile" -ForegroundColor Yellow
$servicePackageFile = Get-SingleFile $servicePackageFile $CsPkg

Write-Host "Get-AzureService -ServiceName $ServiceName -Verbose -ErrorAction SilentlyContinue"
$azureService = Get-AzureService -ServiceName $ServiceName -ErrorAction SilentlyContinue -Verbose
if(!$azureService)
{
    Write-Host "New-AzureService -ServiceName $ServiceName -Location $ServiceLocation -Verbose"
    $azureService = New-AzureService -ServiceName $ServiceName -Location $ServiceLocation -Verbose
}

Write-Host "Get-AzureDeployment -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue -Verbose"
$azureDeployment = Get-AzureDeployment -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue -Verbose
if(!$azureDeployment)
{
    Write-Host "New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Verbose"
    $azureDeployment = New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Verbose
} 
elseif ($allowUpgrade -eq $true)
{
    #Use -Upgrade
    Write-Host "Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Verbose"
    $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Verbose
}
else
{
    #Remove and then Re-create
    Write-Host "Remove-AzureDeployment -ServiceName $ServiceName -Slot $Slot -Force -Verbose"
    $azureOperationContext = Remove-AzureDeployment -ServiceName $ServiceName -Slot $Slot -Force -Verbose
    Write-Host "New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Verbose"
    $azureDeployment = New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Verbose
}

Write-Verbose "Leaving script Publish-AzureCloudDeployment.ps1"