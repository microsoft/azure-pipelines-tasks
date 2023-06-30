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
	
    $arguments = Parse-FileArguments -InputArgs $additionalArguments

    Copy-ToAzureMachines -MachineDnsName $fqdn -StorageAccountName $storageAccount -ContainerName $containerName -SasToken $sasToken -DestinationPath $targetPath -Credential $credential -AzCopyLocation $azCopyLocation -AdditionalArguments  @($arguments[0]) -BlobStorageURI $blobStorageURI -WinRMPort $winRMPort $cleanTargetPathOption $skipCACheckOption $httpProtocolOption $enableDetailedLoggingOption
}