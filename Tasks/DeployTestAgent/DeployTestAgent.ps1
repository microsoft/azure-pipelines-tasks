param(
    [string]$environment, 
    [string]$testMachines,
	[bool]$runAsProcess,
	[string]$machineUserName,
	[string]$machinePassword,
	[bool]$logonAutomatically,
	[bool]$disableScreenSaver,
	[string]$alternateCredsUserName,
	[string]$alternateCredsPassword
)

Write-Verbose "Entering script TestAgentDeploy.ps1"
Write-Verbose "environment = $environment"
Write-Verbose "testMachines = $testMachines"
Write-Verbose "runAsProcess = $runAsProcess"
Write-Verbose "logonAutomatically = $logonAutomatically"
Write-Verbose "disableScreenSaver = $disableScreenSaver"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

Write-Verbose "Leaving script VSTestConsole.ps1"
