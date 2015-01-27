param (
    [string]$environmentName,
    [string]$machineNames, 
    [string]$sourcePackage,
    [string]$applicationPath,
    [string]$scriptPath,
    [string]$initializationScriptPath
    )

Write-Verbose "Entering script RemotePowerShellRunner.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "sourcePackage = $sourcePackage" -Verbose
Write-Verbose "applicationPath = $applicationPath" -Verbose
Write-Verbose "scriptPath = $scriptPath" -Verbose
Write-Verbose "initializationScriptPath = $initializationScriptPath" -Verbose

import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

$port = '5985'

$resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames

$environmentUserName = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "username"
$environmentPassword = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "password"

foreach ($resource in $resources)
{
    $machineUserName = Get-EnvironmentProperty -EnvironmentName $environmentName -ResourceName $resource.Name -Key "username"

    if ($machineUserName -eq $null)
    {
        $machineUserName = $environmentUserName
        $machinePassword = $environmentPassword
    }
    else
    {
        $machinePassword = Get-EnvironmentProperty -EnvironmentName $environmentName -ResourceName $resource.Name -Key "password"
    }

    $credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword

    $fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -ResourceName $resource.Name -Key "fqdn"

    Write-Verbose "Initiating copy on $resource.Name with fqdn: $fqdn, username: $machineUserName" -Verbose

    $copyResponse = Copy-FilesToRemote -MachineDnsName $fqdn -SourceLocalPath $sourcePackage -DestinationLocalPath $applicationPath -Credential $credential

    $log = $copyResponse.Log;

    if ([string]::IsNullOrEmpty($log) -eq $false)
    {
        Write-Verbose "Copy response for $fqdn is $log" -Verbose
    }
    else
    {
        Write-Verbose "Finished Copying" -Verbose
    }
    
    if ($copyResponse.Status -ne "Passed")
    {
        # TODO : Should we fail at first error encountered?
        throw $copyResponse.Error;
    }

    Write-Verbose "Initiating deployment on $resource.Name with fqdn: $fqdn" -Verbose

    $deploymentResponse = Invoke-PsOnRemote -MachineDnsName $fqdn -ScriptPath $scriptPath -WinRMPort $port -Credential $credential -InitializationScriptPath $initializationScriptPath –SkipCACheck -UseHttp

    $log = $deploymentResponse.Log;

    if ([string]::IsNullOrEmpty($log) -eq $false)
    {
        Write-Verbose "Deployment response for $fqdn is $log" -Verbose
    }
    else
    {
        Write-Verbose "Finished Deployment" -Verbose
    }
    
    if ($deploymentResponse.Status -ne "Passed")
    {
        throw $deploymentResponse.Error;
    }
}

Write-Verbose "Leaving script RemotePowerShellRunner.ps1" -Verbose
