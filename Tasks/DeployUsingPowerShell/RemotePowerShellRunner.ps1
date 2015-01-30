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

$resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames -ErrorAction Stop

$machineUserName = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "Username" -ErrorAction Stop

$machinePassword = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "Password" -ErrorAction Stop

$credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword

$envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName "Deployment" -ErrorAction Stop

Write-Verbose "EnvironmentOperationId = $envOperationId" -Verbose

foreach ($resource in $resources)
{
	$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -ErrorAction Stop

	Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
	
    $fqdn = $resource.Name

    Write-Verbose "Initiating copy on $fqdn, username: $machineUserName" -Verbose

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

    $response = $copyResponse
    
    if ($copyResponse.Status -eq "Passed")
    {
        Write-Verbose "Initiating deployment on $fqdn" -Verbose

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

        $response = $deploymentResponse
    }

	Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $response.Status -ErrorMessage $response.Error -Logs $log -ErrorAction Stop
    
    if ($response.Status -ne "Passed")
    {
		Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -ErrorAction Stop

        throw $response.Error;
    }
}

Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Passed" -ErrorAction Stop

Write-Verbose "Leaving script RemotePowerShellRunner.ps1" -Verbose
