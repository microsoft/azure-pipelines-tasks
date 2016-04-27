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

Function CmdletHasMember($memberName) {
    $cmdletParameter = (gcm Invoke-DeployTestAgent).Parameters.Keys.Contains($memberName) 
    return $cmdletParameter
}

Function Get-PersonalAccessToken($vssEndPoint) {
    return $vssEndpoint.Authorization.Parameters.AccessToken
}

Write-Verbose "Entering script DeployTestAgent.ps1"
Write-Verbose "testMachineInput = $testMachineGroup"
Write-Verbose "WinRmProtocal = $winRmProtocol"
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "filter testMachines = $testMachines"
Write-Verbose "runAsProcess = $runAsProcess"
Write-Verbose "logonAutomatically = $logonAutomatically"
Write-Verbose "disableScreenSaver = $disableScreenSaver"
Write-Verbose "updateTestAgent = $updateTestAgent"
Write-Verbose "isDataCollectionOnly = $isDataCollectionOnly"

Write-Host "##vso[task.logissue type=warning;TaskName=DTA]"

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
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

Write-Verbose "Getting the connection object"
$connection = Get-VssConnection -TaskContext $distributedTaskContext

Write-Verbose "Getting Personal Access Token for the Run"
$vssEndPoint = Get-ServiceEndPoint -Context $distributedTaskContext -Name "SystemVssConnection"
$personalAccessToken = Get-PersonalAccessToken $vssEndpoint

if (!$personalAccessToken)
{
    Write-Host "##vso[task.logissue type=error;code=Unable to generate Personal Access Token for the user;TaskName=DTA]"
    throw (Get-LocalizedString -Key "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator")
}

try
{
    $taskContextMemberExists  = CmdletHasMember "TaskContext"

    if($taskContextMemberExists)
    {
        Write-Verbose "Calling Register Environment cmdlet"
        $environment = Register-Environment -EnvironmentName $testMachineGroup -EnvironmentSpecification $testMachineGroup -UserName $adminUserName -Password $adminPassword -TestCertificate ($testCertificate -eq "true") -Connection $connection -TaskContext $distributedTaskContext -WinRmProtocol $winRmProtocol -ResourceFilter $testMachines -Persist
        Write-Verbose "Environment details $environment"

        Write-Verbose "Calling Deploy test agent cmdlet"
        Invoke-DeployTestAgent -TaskContext $distributedTaskContext -MachineEnvironment $environment -UserName $machineUserName -Password $machinePassword -MachineNames $testMachineGroup -RunAsProcess $runAsProcess -LogonAutomatically $logonAutomatically -DisableScreenSaver $disableScreenSaver -AgentLocation $agentLocation -UpdateTestAgent $updateTestAgent -InstallAgentScriptLocation $installAgentScriptLocation -ConfigureTestAgentScriptLocation $configureTestAgentScriptLocation -CheckAgentInstallationScriptLocation $checkAgentInstallationScriptLocation -downloadTestAgentScriptLocation $downloadTestAgentScriptLocation -Connection $connection -PersonalAccessToken $personalAccessToken -DataCollectionOnly $isDataCollectionOnly -VerifyTestMachinesAreInUseScriptLocation $verifyTestMachinesAreInUse
        Write-Verbose "Leaving script DeployTestAgent.ps1"
    }
    else
    {
        Write-Verbose "Calling old Invoke-DeployTestAgent"
        if($resourceFilteringMethod -eq "tags")
        {
            Invoke-DeployTestAgent -TagFilter $testMachines -UserName $machineUserName -Password $machinePassword -PowerShellPort 5985 -TestMachineGroup $testMachineGroup -RunAsProcess $runAsProcess -LogonAutomatically $logonAutomatically -DisableScreenSaver $disableScreenSaver -AgentLocation $agentLocation -UpdateTestAgent $updateTestAgent -InstallAgentScriptLocation $installAgentScriptLocation -ConfigureTestAgentScriptLocation $configureTestAgentScriptLocation -CheckAgentInstallationScriptLocation $checkAgentInstallationScriptLocation -downloadTestAgentScriptLocation $downloadTestAgentScriptLocation -Connection $connection -PersonalAccessToken $personalAccessToken -DataCollectionOnly $isDataCollectionOnly
        }
        else
        {
            Invoke-DeployTestAgent -MachineNames $testMachines -UserName $machineUserName -Password $machinePassword -PowerShellPort 5985 -TestMachineGroup $testMachineGroup -RunAsProcess $runAsProcess -LogonAutomatically $logonAutomatically -DisableScreenSaver $disableScreenSaver -AgentLocation $agentLocation -UpdateTestAgent $updateTestAgent -InstallAgentScriptLocation $installAgentScriptLocation -ConfigureTestAgentScriptLocation $configureTestAgentScriptLocation -CheckAgentInstallationScriptLocation $checkAgentInstallationScriptLocation -downloadTestAgentScriptLocation $downloadTestAgentScriptLocation -Connection $connection -PersonalAccessToken $personalAccessToken -DataCollectionOnly $isDataCollectionOnly
        }
    }
}
catch
{
    Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=DTA]"
    throw
}