param(
    [string]$testMachineGroup, 
    [string]$resourceFilteringMethod,
    [string]$testMachines,
    [string]$runAsProcess,
    [string]$machineUserName,
    [string]$machinePassword,
    [string]$agentLocation,
    [string]$updateTestAgent,
    [string]$isDataCollectionOnly
)

# If Run as process (Run UI Tests) is true both autologon and disable screen saver needs to be true.
$logonAutomatically = $runAsProcess
$disableScreenSaver = $runAsProcess

Write-Verbose "Entering script DeployTestAgent.ps1"
Write-Verbose "testMachineGroup = $testMachineGroup"
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
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

$downloadTestAgentScriptLocation = Join-Path -Path $currentDirectory -ChildPath "DownloadTestAgent.ps1"
Write-Verbose "downloadTestAgentScriptLocation = $downloadTestAgentScriptLocation"

# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DTA"

Write-Verbose "Getting the connection object"
$connection = Get-VssConnection -TaskContext $distributedTaskContext

Write-Verbose "Getting Personal Access Token for the Run"
$vssEndPoint = Get-ServiceEndPoint -Context $distributedTaskContext -Name "SystemVssConnection"
$personalAccessToken = $vssEndpoint.Authorization.Parameters.AccessToken

if ( [string]::IsNullOrEmpty($personalAccessToken))
{
  throw (Get-LocalizedString -Key "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator")
}

Write-Verbose "Calling Invoke-DeployTestAgent"
if($resourceFilteringMethod -eq "tags")
{
    Invoke-DeployTestAgent -TagFilter $testMachines -UserName $machineUserName -Password $machinePassword -PowerShellPort 5985 -TestMachineGroup $testMachineGroup -RunAsProcess $runAsProcess -LogonAutomatically $logonAutomatically -DisableScreenSaver $disableScreenSaver -AgentLocation $agentLocation -UpdateTestAgent $updateTestAgent -InstallAgentScriptLocation $installAgentScriptLocation -ConfigureTestAgentScriptLocation $configureTestAgentScriptLocation -CheckAgentInstallationScriptLocation $checkAgentInstallationScriptLocation -downloadTestAgentScriptLocation $downloadTestAgentScriptLocation -Connection $connection -PersonalAccessToken $personalAccessToken -DataCollectionOnly $isDataCollectionOnly
}
else
{
    Invoke-DeployTestAgent -MachineNames $testMachines -UserName $machineUserName -Password $machinePassword -PowerShellPort 5985 -TestMachineGroup $testMachineGroup -RunAsProcess $runAsProcess -LogonAutomatically $logonAutomatically -DisableScreenSaver $disableScreenSaver -AgentLocation $agentLocation -UpdateTestAgent $updateTestAgent -InstallAgentScriptLocation $installAgentScriptLocation -ConfigureTestAgentScriptLocation $configureTestAgentScriptLocation -CheckAgentInstallationScriptLocation $checkAgentInstallationScriptLocation -downloadTestAgentScriptLocation $downloadTestAgentScriptLocation -Connection $connection -PersonalAccessToken $personalAccessToken -DataCollectionOnly $isDataCollectionOnly
}

Write-Verbose "Leaving script DeployTestAgent.ps1"
