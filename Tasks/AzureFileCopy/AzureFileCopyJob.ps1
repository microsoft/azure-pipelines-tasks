$AzureFileCopyJob = {
param (
    [string]$fqdn,
    [string]$storageAccount,
    [string]$containerName,
    [string]$sasToken,
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

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\*.dll | % {
        [void][reflection.assembly]::LoadFrom( $_.FullName )
        Write-Verbose "Loading .NET assembly:`t$($_.name)"
    }

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\*.dll | % {
        [void][reflection.assembly]::LoadFrom( $_.FullName )
        Write-Verbose "Loading .NET assembly:`t$($_.name)"
    }

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

    [String]$copyToAzureMachinesBlockString = [string]::Empty
    if([string]::IsNullOrWhiteSpace($additionalArguments))
    {
        $copyToAzureMachinesBlockString = "Copy-ToAzureMachines -MachineDnsName `$fqdn -StorageAccountName `$storageAccount -ContainerName `$containerName -SasToken `$sasToken -DestinationPath `$targetPath -Credential `$credential -AzCopyLocation `$azCopyLocation -WinRMPort $winRMPort $cleanTargetPathOption $skipCACheckOption $httpProtocolOption $enableDetailedLoggingOption"
    }
    else
    {
        $copyToAzureMachinesBlockString = "Copy-ToAzureMachines -MachineDnsName `$fqdn -StorageAccountName `$storageAccount -ContainerName `$containerName -SasToken `$sasToken -DestinationPath `$targetPath -Credential `$credential -AzCopyLocation `$azCopyLocation -AdditionalArguments `$additionalArguments -WinRMPort $winRMPort $cleanTargetPathOption $skipCACheckOption $httpProtocolOption $enableDetailedLoggingOption"
    }
    [scriptblock]$copyToAzureMachinesBlock = [scriptblock]::Create($copyToAzureMachinesBlockString)

    $copyResponse = Invoke-Command -ScriptBlock $copyToAzureMachinesBlock
    Write-Output $copyResponse
}