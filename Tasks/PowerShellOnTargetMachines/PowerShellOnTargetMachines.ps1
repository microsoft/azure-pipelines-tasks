[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

# Get inputs for the task
$environmentName = Get-VstsInput -Name EnvironmentName -Require
$adminUserName = Get-VstsInput -Name AdminUserName -Require
$adminPassword = Get-VstsInput -Name AdminPassword -Require
$protocol = Get-VstsInput -Name Protocol
$testCertificate = Get-VstsInput -Name testCertificate
$machineNames = Get-VstsInput -Name MachineNames
$scriptPath = Get-VstsInput -Name ScriptPath -Require
$scriptArguments = Get-VstsInput -Name ScriptArguments
$initializationScriptPath = Get-VstsInput -Name InitializationScriptPath 
$runPowershellInParallel = Get-VstsInput -Name RunPowershellInParallel
$sessionVariables = Get-VstsInput -Name SessionVariables

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/Task.json

. $PSScriptRoot/PowerShellJob.ps1
. $PSScriptRoot/Utility.ps1

# Import all the dlls and modules which have cmdlets we need
Import-Module "$PSScriptRoot\DeploymentUtilities\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal.psm1"
Import-Module "$PSScriptRoot\DeploymentUtilities\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.dll"

# Telemetry
Import-Module $PSScriptRoot\ps_modules\TelemetryHelper

try
{
    # keep machineNames parameter name unchanged due to back compatibility
    $machineFilter = $machineNames
    $scriptPath = $scriptPath.Trim('"')
    $initializationScriptPath = $initializationScriptPath.Trim('"')

    # Normalize admin username
    if($adminUserName -and (-not $adminUserName.StartsWith(".\")) -and ($adminUserName.IndexOf("\") -eq -1) -and ($adminUserName.IndexOf("@") -eq -1))
    {
        $adminUserName = ".\" + $adminUserName 
    } 

    # Getting resource tag key name for corresponding tag
    $resourceFQDNKeyName = Get-ResourceFQDNTagKey
    $resourceWinRMHttpPortKeyName = Get-ResourceHttpTagKey
    $resourceWinRMHttpsPortKeyName = Get-ResourceHttpsTagKey

    # Constants #
    $useHttpProtocolOption = '-UseHttp'
    $useHttpsProtocolOption = ''

    $doSkipCACheckOption = '-SkipCACheck'
    $doNotSkipCACheckOption = ''
    $ErrorActionPreference = 'Stop'
    $deploymentOperation = 'Deployment'

    $envOperationStatus = "Passed"

    # enabling detailed logging only when system.debug is true
    $enableDetailedLoggingString = $env:system_debug
    if ($enableDetailedLoggingString -ne "true")
    {
        $enableDetailedLoggingString = "false"
    }

    try
    {
        Write-Verbose "Starting Register-Environment cmdlet call for environment : $environmentName with filter $machineFilter"
        $environment = Register-Environment -EnvironmentName $environmentName -EnvironmentSpecification $environmentName -UserName $adminUserName -Password $adminPassword -WinRmProtocol $protocol -TestCertificate ($testCertificate -eq "true") -ResourceFilter $machineFilter
        Write-Verbose "Completed Register-Environment cmdlet call for environment : $environmentName"

        Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName"
        $resources = Get-EnvironmentResources -Environment $environment

        if ($resources.Count -eq 0)
        {
            Write-Telemetry "Input_Validation" "No machine exists for given environment"
            throw (Get-VstsLocString -Key "PS_TM_NoMachineExistsUnderEnvironment0ForDeployment" -ArgumentList $environmentName)
        }

        $resourcesPropertyBag = Get-ResourcesProperties -resources $resources
    }
    catch
    {
        Write-Telemetry "Task_InternalError" $_.exception.Message

        throw
    }

    if($runPowershellInParallel -eq $false -or  ( $resources.Count -eq 1 ) )
    {
        foreach($resource in $resources)
        {
            $resourceProperties = $resourcesPropertyBag.Item($resource.Id)
            $machine = $resourceProperties.fqdn
            $displayName = $resourceProperties.displayName
            Write-Output (Get-VstsLocString -Key "PS_TM_DeploymentStartedForMachine0" -ArgumentList $displayName)

            $deploymentResponse = Invoke-Command -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString, $sessionVariables
            Write-ResponseLogs -operationName $deploymentOperation -fqdn $displayName -deploymentResponse $deploymentResponse
            $status = $deploymentResponse.Status

            Write-Output (Get-VstsLocString -Key "PS_TM_DeploymentStatusForMachine01" -ArgumentList $displayName, $status)

            if ($status -ne "Passed")
            {
                Write-Telemetry "DTLSDK_Error" $deploymentResponse.DeploymentSummary
                Write-Verbose $deploymentResponse.Error.ToString()
                $errorMessage =  $deploymentResponse.Error.Message
                throw $errorMessage
            }
        }
    }
    else
    {
        [hashtable]$Jobs = @{} 
        $dtlsdkErrors = @()

        foreach($resource in $resources)
        {
            $resourceProperties = $resourcesPropertyBag.Item($resource.Id)
            $machine = $resourceProperties.fqdn
            $displayName = $resourceProperties.displayName
            Write-Output (Get-VstsLocString -Key "PS_TM_DeploymentStartedForMachine0" -ArgumentList $displayName)

            $job = Start-Job -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString, $sessionVariables
            $Jobs.Add($job.Id, $resourceProperties)
        }
        While ($Jobs.Count -gt 0)
        {
            Start-Sleep 10 
            foreach($job in Get-Job)
            {
                if($Jobs.ContainsKey($job.Id) -and $job.State -ne "Running")
                {
                    $output = Receive-Job -Id $job.Id
                    Remove-Job $Job
                    $status = $output.Status
                    $displayName = $Jobs.Item($job.Id).displayName
                    $resOperationId = $Jobs.Item($job.Id).resOperationId

                    Write-ResponseLogs -operationName $deploymentOperation -fqdn $displayName -deploymentResponse $output
                    Write-Output (Get-VstsLocString -Key "PS_TM_DeploymentStatusForMachine01" -ArgumentList $displayName, $status)
                    if($status -ne "Passed")
                    {
                        $envOperationStatus = "Failed"
                        $errorMessage = ""
                        if($output.Error -ne $null)
                        {
                            $errorMessage = $output.Error.Message
                        }
                        Write-Output (Get-VstsLocString -Key "PS_TM_DeploymentFailedOnMachine0WithFollowingMessage1" -ArgumentList $displayName, $errorMessage)
                        $dtlsdkErrors += $output.DeploymentSummary
                    }
                    $Jobs.Remove($job.Id)
                }
            }
        }
    }

    if($envOperationStatus -ne "Passed")
    {
        foreach ($error in $dtlsdkErrors) {
        Write-Telemetry "DTLSDK_Error" $error
        }
        
        $errorMessage = (Get-VstsLocString -Key 'PS_TM_DeploymentOnOneOrMoreMachinesFailed')
        throw $errorMessage
    }

}
catch
{
    Write-Verbose $_.Exception.ToString() -Verbose
    Write-Telemetry "Task_InternalError" $_.Exception.Message
    throw
}
finally
{
    Trace-VstsLeavingInvocation $MyInvocation
}