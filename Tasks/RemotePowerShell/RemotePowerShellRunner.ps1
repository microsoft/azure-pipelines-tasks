param (
    [string]$machineNames, 
    [int]$port,
    [string]$sourcePackage,
    [string]$machineUserName, 
    [string]$machinePassword,
    [string]$applicationPath,
    [string]$scriptPath,
    [string]$initializationScriptPath
    )

Write-Verbose "Entering script RemotePowerShellRunner.ps1" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "port = $port" -Verbose
Write-Verbose "sourcePackage = $sourcePackage" -Verbose
Write-Verbose "machineUserName = $machineUserName" -Verbose
Write-Verbose "applicationPath = $applicationPath" -Verbose
Write-Verbose "scriptPath = $scriptPath" -Verbose
Write-Verbose "initializationScriptPath = $initializationScriptPath" -Verbose

function Output-ResponseLogs
{
    param([string]$operationName,
          [string]$fqdn,
          [object]$deploymentResponse)

    if ([string]::IsNullOrEmpty($deploymentResponse.DeploymentLog) -eq $false -or [string]::IsNullOrEmpty($deploymentResponse.ServiceLog) -eq $false)
    {
        Write-Verbose "Deployment logs for $operationName operation on $fqdn " -Verbose
        Write-Verbose ($deploymentResponse.DeploymentLog | Format-List | Out-String) -Verbose
        Write-Verbose "Service logs for $operationName operation on $fqdn " -Verbose
        Write-Verbose ($deploymentResponse.ServiceLog | Format-List | Out-String) -Verbose
    }
    else
    {
        Write-Verbose "Finished $operationName operation" -Verbose
    }
}

import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

$credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword

## Temporary check. Assuming that win rm service will be using 5986 port for https connection
$defaultHttpsPort = '5986'
$useHttp = $true

if ( $port -eq $defaultHttpsPort)
{
    $useHttp = $false
}

$machineNameList = $machineNames.Split(",")

foreach ($machineName in $machineNameList)
{
    Write-Verbose "Initiating copy on $machineName" -Verbose
    
    $copyResponse = Copy-FilesToRemote -MachineDnsName $machineName -SourceLocalPath $sourcePackage -DestinationLocalPath $applicationPath -Credential $credential

    Output-ResponseLogs -operationName "copy" -fqdn $machineName -deploymentResponse $copyResponse
    
    if ($copyResponse.Status -ne [Microsoft.VisualStudio.Services.DevTestLabs.Definition.DscStatus]::Passed)
    {
        throw $copyResponse.Error;
    }

    $deploymentMachineSpecification = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Definition.DeploymentMachineSpecification -argumentlist $machineName, $port, $credential, $true, $useHttp, $false 

    Write-Verbose "Initiating deployment on $machineName" -Verbose

    $deploymentResponse = Invoke-PsOnRemote -MachineDnsName $machineName -ScriptPath $scriptPath -WinRMPort $port -Credential $credential -InitializationScriptPath $initializationScriptPath –SkipCACheck -UseHttp    

    Output-ResponseLogs -operationName "deployment" -fqdn $machineName -deploymentResponse $deploymentResponse
    
    if ($deploymentResponse.Status -ne [Microsoft.VisualStudio.Services.DevTestLabs.Definition.DscStatus]::Passed)
    {
        throw $deploymentResponse.Error;
    }
}

Write-Verbose "Leaving script RemotePowerShellRunner.ps1" -Verbose
