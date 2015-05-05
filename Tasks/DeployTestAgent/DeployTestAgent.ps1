param(
    [string]$environment, 
    [string]$testMachines,
    [string]$runAsProcess,
    [string]$machineUserName,
    [string]$machinePassword,
    [string]$alternateCredsUserName,
    [string]$alternateCredsPassword,
    [string]$agentLocation,
    [string]$updateTestAgent,
    [string]$isDataCollectionOnly
)

# If Run as process (Run UI Tests) is true both autologon and disable screen saver needs to be true.
$logonAutomatically = $runAsProcess
$disableScreenSaver = $runAsProcess

Write-Verbose "Entering script DeployTestAgent.ps1"
Write-Verbose "environment = $environment"
Write-Verbose "testMachines = $testMachines"
Write-Verbose "runAsProcess = $runAsProcess"
Write-Verbose "logonAutomatically = $logonAutomatically"
Write-Verbose "disableScreenSaver = $disableScreenSaver"
Write-Verbose "updateTestAgent = $updateTestAgent"
Write-Verbose "isDataCollectionOnly = $isDataCollectionOnly"


if ([string]::IsNullOrWhiteSpace($agentLocation))
{
   Write-Verbose "Download of testagent would begin from internet"
}
else
{
   Write-Verbose "agentLocation = $agentLocation"
}

# Get current directory.
$currentDirectory = Convert-Path .
$installAgentScriptLocation = Join-Path -Path $currentDirectory -ChildPath "TestAgentInstall.ps1"
Write-Verbose "installAgentScriptLocation = $installAgentScriptLocation"

$configureTestAgentScriptLocation = Join-Path -Path $currentDirectory -ChildPath "TestAgentConfiguration.ps1"
Write-Verbose "configureTestAgentScriptLocation = $configureTestAgentScriptLocation"

$checkAgentInstallationScriptLocation = Join-Path -Path $currentDirectory -ChildPath "CheckTestAgentInstallation.ps1"
Write-Verbose "checkAgentInstallationScriptLocation = $checkAgentInstallationScriptLocation"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DistributedTestAutomation"

Write-Verbose "Getting the connection object"
$connection = Get-VssConnection -TaskContext $distributedTaskContext

Write-Verbose "Calling Invoke-DeployTestAgent"
Invoke-DeployTestAgent -MachineNames $testMachines -UserName $machineUserName -Password $machinePassword -PowerShellPort 5985 -EnvironmentName $environment -RunAsProcess $runAsProcess -LogonAutomatically $logonAutomatically -DisableScreenSaver $disableScreenSaver -AlternateCredUserName $alternateCredsUserName -AlternateCredPassword $alternateCredsPassword -AgentLocation $agentLocation -UpdateTestAgent $updateTestAgent -DataCollectionOnly $isDataCollectionOnly -InstallAgentScriptLocation $installAgentScriptLocation -ConfigureTestAgentScriptLocation $configureTestAgentScriptLocation -CheckAgentInstallationScriptLocation $checkAgentInstallationScriptLocation -Connection $connection

Write-Verbose "Leaving script DeployTestAgent.ps1"
