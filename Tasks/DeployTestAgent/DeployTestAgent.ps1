param(
    [string]$environment, 
    [string]$testMachines,
    [string]$runAsProcess,
    [string]$machineUserName,
    [string]$machinePassword,
    [string]$logonAutomatically,
    [string]$disableScreenSaver,
    [string]$alternateCredsUserName,
    [string]$alternateCredsPassword
)

Write-Verbose "Entering script DeployTestAgent.ps1"
Write-Verbose "environment = $environment"
Write-Verbose "testMachines = $testMachines"
Write-Verbose "runAsProcess = $runAsProcess"
Write-Verbose "logonAutomatically = $logonAutomatically"
Write-Verbose "disableScreenSaver = $disableScreenSaver"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DistributedTestAutomation"

Write-Verbose "Calling Invoke-DeployTestAgent"
Invoke-DeployTestAgent -MachineNames $testMachines -UserName $machineUserName -Password $machinePassword -PowerShellPort 5985 -EnvironmentName $environment -RunAsProcess $runAsProcess -LogonAutomatically $logonAutomatically -DisableScreenSaver $disableScreenSaver -AlternateCredUserName $alternateCredsUserName -AlternateCredPassword $alternateCredsPassword

Write-Verbose "Leaving script DeployTestAgent.ps1"
