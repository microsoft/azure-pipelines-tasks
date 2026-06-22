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

# Define a filtering TextWriter that escapes ##vso[ commands from console output.
# The Deployment DLL may write directly to Console.Out / PSHost.UI, bypassing
# PowerShell stream redirection. Must be installed before module imports.
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Text;

public class VsoFilterTextWriter : TextWriter
{
    private TextWriter _inner;
    private StringBuilder _buffer = new StringBuilder();

    public VsoFilterTextWriter(TextWriter inner) { _inner = inner; }
    public override Encoding Encoding { get { return _inner.Encoding; } }

    public override void Write(char value)
    {
        if (value == '\n') { FlushLine(); }
        else { _buffer.Append(value); }
    }

    public override void Write(string value)
    {
        if (value == null) return;
        foreach (char c in value) Write(c);
    }

    public override void WriteLine(string value)
    {
        if (value != null) _buffer.Append(value);
        FlushLine();
    }

    public override void Flush()
    {
        if (_buffer.Length > 0) FlushLine();
        _inner.Flush();
    }

    private void FlushLine()
    {
        string line = _buffer.ToString();
        _buffer.Clear();
        if (line.TrimStart().StartsWith("##vso["))
        {
            _inner.WriteLine(line.Replace("##vso[", "##_vso["));
        }
        else
        {
            _inner.WriteLine(line);
        }
    }

    public void Restore()
    {
        Flush();
        Console.SetOut(_inner);
    }
}
"@ -Language CSharp

$script:vsoFilter = New-Object VsoFilterTextWriter([Console]::Out)
[Console]::SetOut($script:vsoFilter)

# Import all the dlls and modules which have cmdlets we need
Import-Module "$PSScriptRoot\DeploymentUtilities\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal.psm1"
Import-Module "$PSScriptRoot\DeploymentUtilities\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.dll"

# Telemetry
Import-Module $PSScriptRoot\ps_modules\TelemetryHelper


function Publish-Azure-Telemetry
 {
   param([object] $deploymentResponse, [string] $jobId)
    if($deploymentResponse){
       $jsonString = -join("{" , 
       "`"IsAzureVm`" : `"$($deploymentResponse.IsAzureVm)`"" , 
       "," , 
       "`"VmUuidHash`" : `"$($deploymentResponse.VmUuidHash)`"" , 
       "," , 
       "`"TelemetryError`" : `"$($deploymentResponse.TelemetryError)`"" ,
       "," ,
       "`"JobId`" : `"$jobId`"" ,
       "}")
    }

    $telemetryString ="##vso[telemetry.publish area=TaskHub;feature=PowerShellOnTargetMachines]$jsonString"
    Write-Host $telemetryString
 }

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
    $jobId = $env:SYSTEM_JOBID;
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
        Write-Verbose $_.Exception.ToString()
        Write-Telemetry "Task_InternalError" "FaileToFetchResourceProperties"

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

            $deploymentResponse = Invoke-Command -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString, $sessionVariables, $PSScriptRoot
            Write-ResponseLogs -operationName $deploymentOperation -fqdn $displayName -deploymentResponse $deploymentResponse
            $status = $deploymentResponse.Status

            Write-Output (Get-VstsLocString -Key "PS_TM_DeploymentStatusForMachine01" -ArgumentList $displayName, $status)
            Publish-Azure-Telemetry -deploymentResponse $deploymentResponse -jobId $jobId
            if ($status -ne "Passed")
            {
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

            $job = Start-Job -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString, $sessionVariables, $PSScriptRoot
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
                    Publish-Azure-Telemetry -deploymentResponse $output -jobId $jobId
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
        $errorMessage = (Get-VstsLocString -Key 'PS_TM_DeploymentOnOneOrMoreMachinesFailed')
        throw $errorMessage
    }

}
catch
{
    Write-Verbose $_.Exception.ToString()
    $exceptionType = $_.Exception.GetType()
    Write-Telemetry "Task_InternalError" "PowerShellOnTargetMachineTaskFailed:$exceptionType"
    throw
}
finally
{
    Trace-VstsLeavingInvocation $MyInvocation
}