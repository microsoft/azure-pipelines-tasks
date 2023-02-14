Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

try{

    $ServiceName = Get-VstsInput -Name ServiceName -Require
    $ServiceLocation = Get-VstsInput -Name ServiceLocation
    $StorageAccount = Get-VstsInput -Name StorageAccount
    $CsPkg = Get-VstsInput -Name CsPkg -Require
    $CsCfg = Get-VstsInput -Name CsCfg -Require
    $Slot = Get-VstsInput -Name Slot -Require
    $DeploymentLabel = Get-VstsInput -Name DeploymentLabel
    $AppendDateTimeToLabel = Get-VstsInput -Name AppendDateTimeToLabel -Require -AsBool
    $AllowUpgrade = Get-VstsInput -Name AllowUpgrade -Require -AsBool
    $SimultaneousUpgrade = Get-VstsInput -Name SimultaneousUpgrade -AsBool
    $ForceUpgrade = Get-VstsInput -Name ForceUpgrade -AsBool
    $VerifyRoleInstanceStatus = Get-VstsInput -Name VerifyRoleInstanceStatus -AsBool
    $DiagnosticStorageAccountKeys = Get-VstsInput -Name DiagnosticStorageAccountKeys
    $NewServiceAdditionalArguments = Get-VstsInput -Name NewServiceAdditionalArguments
    $NewServiceAffinityGroup = Get-VstsInput -Name NewServiceAffinityGroup
    $NewServiceCustomCertificates = Get-VstsInput -Name NewServiceCustomCertificates

    $EnableAdvancedStorageOptions = Get-VstsInput -Name EnableAdvancedStorageOptions -AsBool
    $ARMConnectedServiceName = Get-VstsInput -Name ARMConnectedServiceName
    $ARMStorageAccount = Get-VstsInput -Name ARMStorageAccount

    # Initialize Azure.
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Initialize-Azure

    # Initialize Azure RM connection if required
    if ($EnableAdvancedStorageOptions)
    {
        $endpoint = Get-VstsEndpoint -Name $ARMConnectedServiceName -Require
        $vstsEndpoint = Get-VstsEndpoint -Name SystemVssConnection -Require
        $vstsAccessToken = $vstsEndpoint.auth.parameters.AccessToken
        $encryptedToken = ConvertTo-SecureString $vstsAccessToken -AsPlainText -Force
        Initialize-AzureRMModule -Endpoint $endpoint -connectedServiceNameARM $ARMConnectedServiceName -vstsAccessToken $encryptedToken
    }

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

        #Add the custom certificates to the newly created Azure Cloud Service
        $customCertificatesMap = Parse-CustomCertificates -CustomCertificates $NewServiceCustomCertificates
        Add-CustomCertificates $serviceName $customCertificatesMap
    }

    if ($StorageAccount) 
    {
        $diagnosticExtensions = Get-DiagnosticsExtensions $StorageAccount $serviceConfigFile $storageAccountKeysMap
    }
    elseif ($ARMStorageAccount)
    {
        $diagnosticExtensions = Get-DiagnosticsExtensions $ARMStorageAccount $serviceConfigFile $storageAccountKeysMap -UseArmStorage
    }
    else 
    {
        Write-Error -Message "Could not determine storage account type from task input"
    }

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
    elseif ($AllowUpgrade -eq $true -and $SimultaneousUpgrade -eq $true -and $ForceUpgrade -eq $true)
    {
        #Use -Upgrade -Mode Simultaneous -Force
        if ($label)
        {
            Write-Host "##[command]Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Mode Simultaneous -Label $label -ExtensionConfiguration <extensions> -Force"
            $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Mode Simultaneous -Label $label -ExtensionConfiguration $diagnosticExtensions -Force
        }
        else
        {
            Write-Host "##[command]Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Mode Simultaneous -ExtensionConfiguration <extensions> -Force"
            $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Mode Simultaneous -ExtensionConfiguration $diagnosticExtensions -Force
        }
    }
    elseif ($AllowUpgrade -eq $true -and $SimultaneousUpgrade -eq $true)
    {
        #Use -Upgrade -Mode Simultaneous
        if ($label)
        {
            Write-Host "##[command]Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Mode Simultaneous -Label $label -ExtensionConfiguration <extensions>"
            $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Mode Simultaneous -Label $label -ExtensionConfiguration $diagnosticExtensions
        }
        else
        {
            Write-Host "##[command]Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Mode Simultaneous -ExtensionConfiguration <extensions>"
            $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Mode Simultaneous -ExtensionConfiguration $diagnosticExtensions
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

    if ($VerifyRoleInstanceStatus -eq $true)
    {
        Validate-AzureCloudServiceStatus -CloudServiceName $ServiceName -Slot $Slot
    }
} finally {
	Trace-VstsLeavingInvocation $MyInvocation
}

