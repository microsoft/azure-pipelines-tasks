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
    [string]$enableDetailedLogging
    )

    Write-Verbose "fqdn = $fqdn" -Verbose
    Write-Verbose "storageAccount = $storageAccount" -Verbose
    Write-Verbose "containerName = $containerName" -Verbose
    Write-Verbose "sasToken = $sasToken" -Verbose
    Write-Verbose "azCopyLocation = $azCopyLocation" -Verbose
    Write-Verbose "targetPath = $targetPath" -Verbose
    Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy" -Verbose
    Write-Verbose "winRMPort = $winRMPort" -Verbose
    Write-Verbose "httpProtocolOption = $httpProtocolOption" -Verbose
    Write-Verbose "skipCACheckOption = $skipCACheckOption" -Verbose
    Write-Verbose "enableDetailedLogging = $enableDetailedLogging" -Verbose

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\*.dll | % {
        [void][reflection.assembly]::LoadFrom( $_.FullName )
        Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
    }

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\*.dll | % {
        [void][reflection.assembly]::LoadFrom( $_.FullName )
        Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
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

    Write-Verbose "Initiating copy on $fqdn " -Verbose

    [String]$copyToAzureMachinesBlockString = "Copy-ToAzureMachines -MachineDnsName `$fqdn -StorageAccountName `$storageAccount -ContainerName `$containerName -SasToken `$sasToken -DestinationPath `$targetPath -Credential `$credential -AzCopyLocation `$azCopyLocation -WinRMPort $winRMPort $cleanTargetPathOption $skipCACheckOption $httpProtocolOption $enableDetailedLoggingOption"
    [scriptblock]$copyToAzureMachinesBlock = [scriptblock]::Create($copyToAzureMachinesBlockString)

    $copyResponse = Invoke-Command -ScriptBlock $copyToAzureMachinesBlock
    Write-Output $copyResponse
}