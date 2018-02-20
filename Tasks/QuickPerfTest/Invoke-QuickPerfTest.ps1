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
$machineType,
[String] [Parameter(Mandatory = $false)]
$resourceGroupName,
[String] [Parameter(Mandatory = $false)]
$numOfSelfProvisionedAgents,
[String] [Parameter(Mandatory = $false)]
$avgResponseTimeThreshold
)

function InitializeRestHeaders()
{
	$restHeaders = New-Object -TypeName "System.Collections.Generic.Dictionary[[String], [String]]"
	if([string]::IsNullOrWhiteSpace($connectedServiceName))
	{
		$patToken = GetAccessToken $connectedServiceDetails
		ValidatePatToken $patToken
		$restHeaders.Add("Authorization", [String]::Concat("Bearer ", $patToken))
		
	}
	else
	{
		$Username = $connectedServiceDetails.Authorization.Parameters.Username
		Write-Verbose "Username = $Username" -Verbose
		$Password = $connectedServiceDetails.Authorization.Parameters.Password
		$alternateCreds = [String]::Concat($Username, ":", $Password)
		$basicAuth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($alternateCreds))
		$restHeaders.Add("Authorization", [String]::Concat("Basic ", $basicAuth))
	}
	return $restHeaders
}

function GetAccessToken($vssEndPoint) 
{
	return $vssEndpoint.Authorization.Parameters.AccessToken
}

function ValidatePatToken($token)
{
	if([string]::IsNullOrWhiteSpace($token))
	{
		throw "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator"
	}
}

# Load all dependent files for execution
. $PSScriptRoot/CltTasksUtility.ps1
. $PSScriptRoot/VssConnectionHelper.ps1
. $PSScriptRoot/CltThresholdValidationHelper

#Set the userAgent appropriately based on whether the task is running as part of a ci or cd
if($Env:SYSTEM_HOSTTYPE -ieq "build") {    
    $userAgent = "QuickPerfTestBuildTask"
}
else {
    $userAgent = "QuickPerfTestReleaseTask"
}
$global:RestTimeout = 60

############################################## PS Script execution starts here ##########################################
Write-Output "Starting Quick Perf Test Script"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DTA"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

$testName = $testName + ".loadtest"
Write-Output "Test name = $testName"
Write-Output "Run duration = $runDuration"
Write-Output "Website Url = $websiteUrl"
Write-Output "Virtual user load = $vuLoad"
Write-Output "Load location = $geoLocation"
Write-Output "Load generator machine type = $machineType"
Write-Output "Self-provisioned rig = $resourceGroupName"
Write-Output "Num of agents = $numOfSelfProvisionedAgents"
Write-Output "Run source identifier = build/$env:SYSTEM_DEFINITIONID/$env:BUILD_BUILDID"

#Validate Input
ValidateInputs $websiteUrl $env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI $connectedServiceName $testName

#Process Threshold Rules
Write-Output "Initializing threshold rule for avg. response time with value(ms) : $avgResponseTimeThreshold "
$avgResponseTimeThreshold = ValidateAvgResponseTimeThresholdInput $avgResponseTimeThreshold

#Initialize Connected Service Details
if([string]::IsNullOrWhiteSpace($connectedServiceName))
{
	$connectedServiceDetails = Get-ServiceEndpoint -Context $distributedTaskContext -Name SystemVssConnection
}
else
{
	$connectedServiceDetails = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName
}

$VSOAccountUrl = $connectedServiceDetails.Url.AbsoluteUri
Write-Output "VSO Account URL is : $VSOAccountUrl"
$headers = InitializeRestHeaders
$CltAccountUrl = ComposeAccountUrl $VSOAccountUrl $headers
$TFSAccountUrl = $env:System_TeamFoundationCollectionUri.TrimEnd('/')

Write-Output "VSO account Url = $TFSAccountUrl" -Verbose
Write-Output "CLT account Url = $CltAccountUrl" -Verbose

$dropjson = ComposeTestDropJson $testName $runDuration $websiteUrl $vuLoad $geoLocation

$drop = CreateTestDrop $headers $dropjson $CltAccountUrl

if ($drop.dropType -eq "InPlaceDrop")
{
	$runJson = ComposeTestRunJson $testName $drop.id $vuLoad $runDuration $MachineType $resourceGroupName $numOfSelfProvisionedAgents
	$run = QueueTestRun $headers $runJson $CltAccountUrl
	MonitorTestRun $headers $run $CltAccountUrl
	$webResultsUrl = GetTestRunUri $run.id $headers $CltAccountUrl
	
	Write-Output ("Run-id for this load test is {0} and its name is '{1}'." -f  $run.runNumber, $run.name)
	Write-Output ("To view run details navigate to {0}" -f $webResultsUrl)
	Write-Output "To view detailed results navigate to Load Test | Load Test Manager in Visual Studio IDE, and open this run."

	$resultsMDFolder = New-Item -ItemType Directory -Force -Path "$env:Temp\LoadTestResultSummary"	
	$resultFilePattern = ("QuickPerfTestResults_{0}_{1}_*.md" -f $env:AGENT_ID, $env:SYSTEM_DEFINITIONID)
	$excludeFilePattern = ("QuickPerfTestResults_{0}_{1}_{2}_*.md" -f $env:AGENT_ID, $env:SYSTEM_DEFINITIONID, $env:BUILD_BUILDID)
	
	if($avgResponseTimeThreshold)
	{
		$avgResponseTimeThresholdValidationResult = ValidateAvgResponseTimeThreshold $CltAccountUrl $headers $run.id $avgResponseTimeThreshold 
		if($avgResponseTimeThresholdValidationResult -eq $false)
		{
			Write-Output "The Avg.Response Time for the run is greater than the threshold value of $avgResponseTimeThreshold specified for the run "
			Write-Output "To view detailed results navigate to Load Test | Load Test Manager in Visual Studio IDE, and open this run."
			Write-Error "Load test task is marked as failed, as there were threshold violations for the Avg. Response Time"
		}
	}

	Remove-Item $resultsMDFolder\$resultFilePattern -Exclude $excludeFilePattern -Force	
	$summaryFile =  ("{0}\QuickPerfTestResults_{1}_{2}_{3}_{4}.md" -f $resultsMDFolder, $env:AGENT_ID, $env:SYSTEM_DEFINITIONID, $env:BUILD_BUILDID, $run.id)	

	if ($thresholdViolationsCount -gt 0)
	{
		$thresholdMessage=("{0} thresholds violated." -f $thresholdViolationsCount)
		$thresholdImage="bowtie-status-error"
		$thresholdImageLabel="Error"
	}
	else
	{
		$thresholdMessage="No thresholds violated."
		$thresholdImage="bowtie-status-success"
		$thresholdImageLabel="Success"
	}
	$summary = ('[Test Run: {0}]({1}) using {2}.<br/>' -f  $run.runNumber, $webResultsUrl ,$run.name)
	$summary = ('<span class="bowtie-icon {3}" role="img" aria-label="{5}" />   {4}<br/><a href="{1}" target="_blank">Test Run: {0}</a> using {2}.<br/>' -f  $run.runNumber, $webResultsUrl , $run.name, $thresholdImage, $thresholdMessage, $thresholdImageLabel)

	('<p>{0}</p>' -f $summary) | Out-File  $summaryFile -Encoding ascii -Append
	UploadSummaryMdReport $summaryFile
}
else
{
	Write-Error ("Failed to connect to the endpoint '{0}' for VSO account '{1}'" -f $EndpointName, $VSOAccountUrl)
}


Write-Output "Quick Perf Test Script execution completed"

