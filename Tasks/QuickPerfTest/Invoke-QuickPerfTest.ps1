[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String]
    $env:SYSTEM_DEFINITIONID,
    [String]
    $env:BUILD_BUILDID,

    [String] [Parameter(Mandatory = $false)]
    $connectedServiceName,

    [String] [Parameter(Mandatory = $true)]
    $websiteUrl,
    [String] [Parameter(Mandatory = $true)]
    $testName,
    [String] [Parameter(Mandatory = $true)]
    $vuLoad,
    [String] [Parameter(Mandatory = $true)]
    $runDuration,
    [String] [Parameter(Mandatory = $true)]
    $geoLocation,
    [String] [Parameter(Mandatory = $true)]
    $machineType
)

  # Load all dependent files for execution
  . $PSScriptRoot/CltTasksUtility.ps1
  . $PSScriptRoot/VssConnectionHelper.ps1
  
$userAgent = "QuickPerfTestBuildTask"
$global:RestTimeout = 60

############################################## PS Script execution starts here ##########################################
Write-Output "Starting Quick Perf Test Script"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$testName = $testName + ".loadtest"
Write-Output "Test name = $testName"
Write-Output "Run duration = $runDuration"
Write-Output "Website Url = $websiteUrl"
Write-Output "Virtual user load = $vuLoad"
Write-Output "Load location = $geoLocation"
Write-Output "Load generator machine type = $machineType"
Write-Output "Run source identifier = build/$env:SYSTEM_DEFINITIONID/$env:BUILD_BUILDID"

Write-Output "visuri- Validating inputs"
#Validate Input
ValidateInputs $websiteUrl
Write-Output "visuri- Validating inputs succeeded"

if($connectedServiceName)
{
    $connectedServiceDetails = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName
}
else
{
	$connectedServiceDetails = Get-ServiceEndpoint -Context $distributedTaskContext -Name SystemVssConnection
}


$Username = $connectedServiceDetails.Authorization.Parameters.Username
Write-Verbose "Username = $Username" -Verbose
$Password = $connectedServiceDetails.Authorization.Parameters.Password
$VSOAccountUrl = $connectedServiceDetails.Url.AbsoluteUri
Write-Output "visuri- Compose Account Url called"
Write-Output "VSO Account URL is : $VSOAccountUrl"
$CltAccountUrl = ComposeAccountUrl($VSOAccountUrl)
$TFSAccountUrl = $env:System_TeamFoundationCollectionUri.TrimEnd('/')
Write-Output "visuri- Compose Account Url succeeded"

Write-Output "VSO account Url = $TFSAccountUrl" -Verbose
Write-Output "CLT account Url = $CltAccountUrl" -Verbose

Write-Output "visuri- Initializing Rest Headers"
$headers = InitializeRestHeaders($connectedServiceName)
Write-Output "visuri- Initializing Rest Headers succeeded"

Write-Output "visuri- Compose Test Drop"
$dropjson = ComposeTestDropJson $testName $runDuration $websiteUrl $vuLoad $geoLocation
Write-Output "visuri- Compose Test Drop succeeded"

Write-Output "visuri- Create Test Drop"
$drop = CreateTestDrop $headers $dropjson $CltAccountUrl
Write-Output "visuri- Create Test Drop succeeded"

if ($drop.dropType -eq "InPlaceDrop")
{
    $runJson = ComposeTestRunJson $testName $drop.id $MachineType

	Write-Output "visuri- Queuing Test run"
    $run = QueueTestRun $headers $runJson $CltAccountUrl
	Write-Output "visuri- Queuing Test run succeeded"
	Write-Output "visuri- Monitor Test run"
    MonitorTestRun $headers $run $CltAccountUrl
	Write-Output "visuri- Get Test run Uri"
    $webResultsUrl = GetTestRunUri $run.id $headers $CltAccountUrl
	
    Write-Output ("Run-id for this load test is {0} and its name is '{1}'." -f  $run.runNumber, $run.name)
    Write-Output ("To view run details navigate to {0}" -f $webResultsUrl)
    Write-Output "To view detailed results navigate to Load Test | Load Test Manager in Visual Studio IDE, and open this run."

    $resultsMDFolder = New-Item -ItemType Directory -Force -Path "$env:Temp\LoadTestResultSummary"
	
    $resultFilePattern = ("QuickPerfTestResults_{0}_{1}_*.md" -f $env:AGENT_ID, $env:SYSTEM_DEFINITIONID)
	
    $excludeFilePattern = ("QuickPerfTestResults_{0}_{1}_{2}_*.md" -f $env:AGENT_ID, $env:SYSTEM_DEFINITIONID, $env:BUILD_BUILDID)   
    Remove-Item $resultsMDFolder\$resultFilePattern -Exclude $excludeFilePattern -Force	
    $summaryFile =  ("{0}\QuickPerfTestResults_{1}_{2}_{3}_{4}.md" -f $resultsMDFolder, $env:AGENT_ID, $env:SYSTEM_DEFINITIONID, $env:BUILD_BUILDID, $run.id)	
	
    $summary = ('[Test Run: {0}]({1}) using {2}.<br/>' -f  $run.runNumber, $webResultsUrl ,$run.name)

	('<p>{0}</p>' -f $summary) >>  $summaryFile
    UploadSummaryMdReport $summaryFile
}
else
{
    Write-Error ("Failed to connect to the endpoint '{0}' for VSO account '{1}'" -f $EndpointName, $VSOAccountUrl)
}

	
Write-Output "Quick Perf Test Script execution completed"

