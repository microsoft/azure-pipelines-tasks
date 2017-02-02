Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

try{

    $ServiceName = Get-VstsInput -Name ServiceName -Require
    $ServiceLocation = Get-VstsInput -Name ServiceLocation
    $StorageAccount = Get-VstsInput -Name StorageAccount -Require
    $CsPkg = Get-VstsInput -Name CsPkg -Require
    $CsCfg = Get-VstsInput -Name CsCfg -Require
    $Slot = Get-VstsInput -Name Slot -Require
    $DeploymentLabel = Get-VstsInput -Name DeploymentLabel
    $AppendDateTimeToLabel = Get-VstsInput -Name AppendDateTimeToLabel -Require
    $AllowUpgrade = Get-VstsInput -Name AllowUpgrade -Require -AsBool
    $ForceUpgrade = Get-VstsInput -Name ForceUpgrade -Require -AsBool
    $DiagnosticStorageAccountKeys = Get-VstsInput -Name DiagnosticStorageAccountKeys
    $NewServiceAdditionalArguments = Get-VstsInput -Name NewServiceAdditionalArguments
    $NewServiceAffinityGroup = Get-VstsInput -Name NewServiceAffinityGroup

    # Initialize Azure.
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Initialize-Azure

    # Load all dependent files for execution
    . $PSScriptRoot/Utility.ps1

    $storageAccountKeysMap = Parse-StorageKeys -StorageAccountKeys $DiagnosticStorageAccountKeys

    Write-Host "Finding $CsCfg"
    $serviceConfigFile = Find-VstsFiles -LegacyPattern "$CsCfg"
    Write-Host "serviceConfigFile= $serviceConfigFile"
    $serviceConfigFile = Get-SingleFile $serviceConfigFile $CsCfg

    Write-Host "Find-VstsFiles -LegacyPattern $CsPkg"
    $servicePackageFile = Find-VstsFiles -LegacyPattern "$CsPkg"
    Write-Host "servicePackageFile= $servicePackageFile"
    $servicePackageFile = Get-SingleFile $servicePackageFile $CsPkg

    Write-Host "##[command]Get-AzureService -ServiceName $ServiceName -ErrorAction SilentlyContinue  -ErrorVariable azureServiceError"
    $azureService = Get-AzureService -ServiceName $ServiceName -ErrorAction SilentlyContinue  -ErrorVariable azureServiceError

    if($azureServiceError){
       $azureServiceError | ForEach-Object { Write-Verbose $_.Exception.ToString() }
    }   

   
    if (!$azureService)
    {    
        $azureService = "New-AzureService -ServiceName `"$ServiceName`""
        if($NewServiceAffinityGroup) {
            $azureService += " -AffinityGroup `"$NewServiceAffinityGroup`""
        }
        elseif($ServiceLocation) {
             $azureService += " -Location `"$ServiceLocation`""
        }
        else {
            throw "Either AffinityGroup or ServiceLocation must be specified"
        }
        $azureService += " $NewServiceAdditionalArguments"
        Write-Host "$azureService"
        $azureService = Invoke-Expression -Command $azureService
    }

    $diagnosticExtensions = Get-DiagnosticsExtensions $StorageAccount $serviceConfigFile $storageAccountKeysMap

    $label = $DeploymentLabel

    if ($label -and $AppendDateTimeToLabel)
    {
        $label += " "
        $label += [datetime]::now
    }

    Write-Host "##[command]Get-AzureDeployment -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue -ErrorVariable azureDeploymentError"
    $azureDeployment = Get-AzureDeployment -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue -ErrorVariable azureDeploymentError

    if($azureDeploymentError) {
       $azureDeploymentError | ForEach-Object { Write-Verbose $_.Exception.ToString() }
    }

    if (!$azureDeployment)
    {
        if ($label)
        {
            Write-Host "##[command]New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Label $label -ExtensionConfiguration <extensions>"
            $azureDeployment = New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Label $label -ExtensionConfiguration $diagnosticExtensions
        }
        else
        {
            Write-Host "##[command]New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration <extensions>"
            $azureDeployment = New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration $diagnosticExtensions
        }
    } 
    elseif ($AllowUpgrade -eq $true -and $ForceUpgrade -eq $true)
    {
        #Use -Upgrade
        if ($label)
        {
            Write-Host "##[command]Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Label $label -ExtensionConfiguration <extensions> -Force"
            $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Label $label -ExtensionConfiguration $diagnosticExtensions -Force
        }
        else
        {
            Write-Host "##[command]Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration <extensions> -Force"
            $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration $diagnosticExtensions -Force
        }
    }
    elseif ($AllowUpgrade -eq $true) 
    {
        #Use -Upgrade
        if ($label)
        {
            Write-Host "##[command]Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Label $label -ExtensionConfiguration <extensions>"
            $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Label $label -ExtensionConfiguration $diagnosticExtensions
        }
        else
        {
            Write-Host "##[command]Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration <extensions>"
            $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration $diagnosticExtensions
        }
    }
    else
    {
        #Remove and then Re-create
        Write-Host "##[command]Remove-AzureDeployment -ServiceName $ServiceName -Slot $Slot -Force"
        $azureOperationContext = Remove-AzureDeployment -ServiceName $ServiceName -Slot $Slot -Force
        if ($label)
        {
            Write-Host "##[command]New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Label $label -ExtensionConfiguration <extensions>"
            $azureDeployment = New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Label $label -ExtensionConfiguration $diagnosticExtensions
        }
        else
        {
            Write-Host "##[command]New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration <extensions>"
            $azureDeployment = New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration $diagnosticExtensions
        }
    }


} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}

