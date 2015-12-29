param(
    [string]$testMachineGroup,
    [string]$adminUserName,
    [string]$adminPassword,
    [string]$winRmProtocol,
    [string]$testCertificate,
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
Write-Verbose "testMachineInput = $testMachineGroup"
Write-Verbose "WinRmProtocal = $winRmProtocol"
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

$verifyTestMachinesAreInUse = Join-Path -Path $currentDirectory -ChildPath "VerifyTestMachinesAreInUse.ps1"
Write-Verbose "VerifyTestMachinesAreInUseScriptLocation = $verifyTestMachinesAreInUse"
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
    Write-Host "##vso[task.logissue type=error;code=001002;]"
    throw (Get-LocalizedString -Key "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator")
}

Write-Verbose "Calling Register Environment cmdlet"
$environment = Register-Environment -EnvironmentName $environmentName -EnvironmentSpecification $testMachineGroup -UserName $adminUserName -Password $adminPassword -TestCertificate ($testCertificate -eq "true") -Connection $connection -TaskContext $distributedTaskContext -WinRmProtocol $winRmProtocol
Write-Verbose "Environment details $environment"

Write-Verbose "Calling Deploy test agent cmdlet"
Invoke-DeployTestAgent -TaskContext $distributedTaskContext -MachineEnvironment $environment -UserName $machineUserName -Password $machinePassword -MachineNames $testMachineGroup -RunAsProcess $runAsProcess -LogonAutomatically $logonAutomatically -DisableScreenSaver $disableScreenSaver -AgentLocation $agentLocation -UpdateTestAgent $updateTestAgent -InstallAgentScriptLocation $installAgentScriptLocation -ConfigureTestAgentScriptLocation $configureTestAgentScriptLocation -CheckAgentInstallationScriptLocation $checkAgentInstallationScriptLocation -downloadTestAgentScriptLocation $downloadTestAgentScriptLocation -Connection $connection -PersonalAccessToken $personalAccessToken -DataCollectionOnly $isDataCollectionOnly -WinRmProtocol $winRmProtocol -VerifyTestMachinesAreInUseScriptLocation $verifyTestMachinesAreInUse
Write-Verbose "Leaving script DeployTestAgent.ps1"
