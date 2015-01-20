param (
    [string]$environmentName,
    [string]$machineNames, 
    [string]$sourcePackage,
    [string]$machineUserName, 
    [string]$machinePassword,
    [string]$applicationPath,
    [string]$scriptPath,
    [string]$initializationScriptPath
    )

Write-Verbose "Entering script RemotePowerShellRunner.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "sourcePackage = $sourcePackage" -Verbose
Write-Verbose "machineUserName = $machineUserName" -Verbose
Write-Verbose "applicationPath = $applicationPath" -Verbose
Write-Verbose "scriptPath = $scriptPath" -Verbose
Write-Verbose "initializationScriptPath = $initializationScriptPath" -Verbose

$credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword
$port = '5985'

import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

$resources = Get-EnvironmentResources -environmentName $environmentName -resources $machineNames

foreach ($resource in $resources)
{
    $bag = $resource.PropertyBag.Bag
    $fqdn = $bag["fqdn"].Data

    Write-Verbose "Initiating copy on $resource.Name with fqdn: $fqdn" -Verbose

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
