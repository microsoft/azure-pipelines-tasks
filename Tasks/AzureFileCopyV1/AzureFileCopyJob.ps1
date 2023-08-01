$AzureFileCopyJob = {
param (
    [string]$deploymentUtilitiesLocation,
    [string]$fqdn,
    [string]$storageAccount,
    [string]$containerName,
    [string]$sasToken,
    [string]$blobStorageEndpoint,
    [string]$azCopyLocation,
    [string]$targetPath,
    [object]$credential,
    [string]$cleanTargetBeforeCopy,
    [string]$winRMPort,
    [string]$httpProtocolOption,
    [string]$skipCACheckOption,
    [string]$enableDetailedLogging,
    [string]$additionalArguments
    )

    Write-Verbose "fqdn = $fqdn"
    Write-Verbose "storageAccount = $storageAccount"
    Write-Verbose "containerName = $containerName"
    Write-Verbose "sasToken = $sasToken"
    Write-Verbose "azCopyLocation = $azCopyLocation"
    Write-Verbose "targetPath = $targetPath"
    Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy"
    Write-Verbose "winRMPort = $winRMPort"
    Write-Verbose "httpProtocolOption = $httpProtocolOption"
    Write-Verbose "skipCACheckOption = $skipCACheckOption"
    Write-Verbose "enableDetailedLogging = $enableDetailedLogging"
    Write-Verbose "additionalArguments = $additionalArguments"

    Import-Module "$deploymentUtilitiesLocation\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.dll"

    $cleanTargetPathOption = ''
    if ($cleanTargetBeforeCopy -eq "true")
    {
        $cleanTargetPathOption = '-CleanTargetPath'
    }

    $enableDetailedLoggingOption = ''
    if ($enableDetailedLogging -eq "true")
    {
        $enableDetailedLoggingOption = '-EnableDetailedLogging'
    }

    Write-Verbose "Initiating copy on $fqdn "

	if(-not [string]::IsNullOrWhiteSpace($blobStorageEndpoint))
    {
        $blobStorageURI = $blobStorageEndpoint+$containerName+"/"+$blobPrefix
    }

    $featureFlags = @{
        audit     = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_NEW_LOGIC_LOG)
        activate  = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_NEW_LOGIC)
        telemetry = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_COLLECT)
    }
    Write-Verbose "Feature flag AZP_75787_ENABLE_NEW_LOGIC state: $($featureFlags.activate)"

    if ($featureFlags.activate -or $featureFlags.audit -or $featureFlags.telemetry){
        $sanitizedArguments = Protect-ScriptArguments -InputArgs $additionalArguments -TaskName "AzureFileCopyV1"
    }
    if ($featureFlags.activate) {
        Copy-ToAzureMachines -MachineDnsName $fqdn -StorageAccountName $storageAccount -ContainerName $containerName -SasToken $sasToken -DestinationPath $targetPath -Credential $credential -AzCopyLocation $azCopyLocation -AdditionalArguments $sanitizedArguments -BlobStorageURI $blobStorageURI -WinRMPort $winRMPort $cleanTargetPathOption $skipCACheckOption $httpProtocolOption $enableDetailedLoggingOption
    } else {
        [String]$copyToAzureMachinesBlockString = [string]::Empty
        if([string]::IsNullOrWhiteSpace($additionalArguments))
        {
            $copyToAzureMachinesBlockString = "Copy-ToAzureMachines -MachineDnsName `$fqdn -StorageAccountName `$storageAccount -ContainerName `$containerName -SasToken `$sasToken -DestinationPath `$targetPath -Credential `$credential -AzCopyLocation `$azCopyLocation -BlobStorageURI `$blobStorageURI -WinRMPort $winRMPort $cleanTargetPathOption $skipCACheckOption $httpProtocolOption $enableDetailedLoggingOption"
        }
        else
        {
            $copyToAzureMachinesBlockString = "Copy-ToAzureMachines -MachineDnsName `$fqdn -StorageAccountName `$storageAccount -ContainerName `$containerName -SasToken `$sasToken -DestinationPath `$targetPath -Credential `$credential -AzCopyLocation `$azCopyLocation -AdditionalArguments `$additionalArguments -BlobStorageURI `$blobStorageURI -WinRMPort $winRMPort $cleanTargetPathOption $skipCACheckOption $httpProtocolOption $enableDetailedLoggingOption"
        }
        [scriptblock]$copyToAzureMachinesBlock = [scriptblock]::Create($copyToAzureMachinesBlockString)

        $copyResponse = Invoke-Command -ScriptBlock $copyToAzureMachinesBlock
        Write-Output $copyResponse
    }
}