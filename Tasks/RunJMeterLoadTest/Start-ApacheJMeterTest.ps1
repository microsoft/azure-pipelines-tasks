[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
[String]
$env:SYSTEM_DEFINITIONID,
[String]
$env:BUILD_BUILDID,

[String] [Parameter(Mandatory = $false)]
$connectedServiceName,

[String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
$TestDrop,
[String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
$LoadTest,

[String] [Parameter(Mandatory = $true)]
$agentCount,
[String] [Parameter(Mandatory = $true)]
$runDuration,
[String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
$machineType
)

#Set the userAgent appropriately based on whether the task is running as part of a ci or cd
if($Env:SYSTEM_HOSTTYPE -ieq "build") {
    $userAgent = "ApacheJmeterTestBuildTask"
}
else {
    $userAgent = "ApacheJmeterTestReleaseTask"
}
$global:RestTimeout = 60
$global:apiVersion = "api-version=1.0"

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

function WriteTaskMessages($message)
{
	Write-Host ("{0}" -f $message ) -NoNewline
}

############################################## PS Script execution starts here ##########################################
WriteTaskMessages "Starting Load Test Script"

# Load all dependent files for execution
. $PSScriptRoot/CltTasksUtility.ps1
. $PSScriptRoot/VssConnectionHelper.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DTA"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

Write-Output "Test drop = $TestDrop"
Write-Output "Load test = $LoadTest"
Write-Output "Load generator machine type = $machineType"
Write-Output "Run source identifier = build/$env:SYSTEM_DEFINITIONID/$env:BUILD_BUILDID"

$machineType = 0
Write-Output "Reset Load generator machine type to $machineType"

#Validate Input
ValidateInputs $env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI $connectedServiceName $testDrop $loadTest

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

Write-Output "TFS account Url = $TFSAccountUrl" -Verbose
Write-Output "CLT account Url = $CltAccountUrl" -Verbose

#Upload the test drop
$elapsed = [System.Diagnostics.Stopwatch]::StartNew()
$drop = CreateTestDrop $headers $CltAccountUrl

if ($drop.dropType -eq "TestServiceBlobDrop")
{
	$drop = GetTestDrop $headers $drop $CltAccountUrl
	UploadTestDrop $drop $global:ScopedTestDrop
	WriteTaskMessages ("Uploading test files took {0}. Queuing the test run." -f $($elapsed.Elapsed.ToString()))

	#Queue the test run
	$runJson = ComposeTestRunJson $LoadTest $drop.id $agentCount $runDuration $machineType
	$run = QueueTestRun $headers $runJson $CltAccountUrl
	MonitorAcquireResource $headers $run $CltAccountUrl

	#Monitor the test run
	$elapsed = [System.Diagnostics.Stopwatch]::StartNew()
	MonitorTestRun $headers $run $CltAccountUrl
	WriteTaskMessages ( "Run execution took {0}. Collecting results." -f $($elapsed.Elapsed.ToString()))

	#Print the error and messages
	$run = GetTestRun $headers $run.id $CltAccountUrl
	ShowMessages $headers $run $CltAccountUrl
	PrintErrorSummary $headers $run $CltAccountUrl

	if ($run.state -ne "completed")
	{
		Write-Error "Load test has failed. Please check error messages to fix the problem."
	}
	else
	{
		WriteTaskMessages "The load test completed successfully."
	}

	$run = GetTestRun $headers $run.id $CltAccountUrl
	$webResultsUrl = $run.WebResultUrl
	Write-Output ("Run-id for this load test is {0} and its name is '{1}'." -f  $run.runNumber, $run.name)
	Write-Output ("To view run details navigate to {0}" -f $webResultsUrl)

	$resultsMDFolder = New-Item -ItemType Directory -Force -Path "$env:Temp\LoadTestResultSummary"
	$resultFilePattern = ("ApacheJMeterTestResults_{0}_{1}_*.md" -f $env:AGENT_ID, $env:SYSTEM_DEFINITIONID)
	$excludeFilePattern = ("ApacheJMeterTestResults_{0}_{1}_{2}_*.md" -f $env:AGENT_ID, $env:SYSTEM_DEFINITIONID, $env:BUILD_BUILDID)
	Remove-Item $resultsMDFolder\$resultFilePattern -Exclude $excludeFilePattern -Force
	$summaryFile =  ("{0}\ApacheJMeterTestResults_{1}_{2}_{3}_{4}.md" -f $resultsMDFolder, $env:AGENT_ID, $env:SYSTEM_DEFINITIONID, $env:BUILD_BUILDID, $run.id)

	$summary = ('[Test Run: {0}]({1}) using {2}.<br/>' -f  $run.runNumber, $webResultsUrl , $run.name)
	
	('<p>{0}</p>' -f $summary) | Out-File  $summaryFile -Encoding ascii -Append
	UploadSummaryMdReport $summaryFile
}
else
{
	Write-Error ("Connection '{0}' failed for service '{1}'" -f $connectedServiceName, $connectedServiceDetails.Url.AbsoluteUri)
	("Connection '{0}' failed for service '{1}'" -f $connectedServiceName, $connectedServiceDetails.Url.AbsoluteUri) >> $summaryFile
}

WriteTaskMessages "JMeter Test Script execution completed"

