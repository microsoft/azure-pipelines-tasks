[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
[String]
$env:SYSTEM_DEFINITIONID,
[String]
$env:BUILD_BUILDID,

[String] [Parameter(Mandatory = $false)]
$connectedServiceName,

[String] [Parameter(Mandatory = $false)]
$TestSettings,
[String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
$TestDrop,
[String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
$LoadTest,
[String]
$ThresholdLimit,
[String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
$MachineType,
[String] [Parameter(Mandatory = $false)]
$resourceGroupName,
[String] [Parameter(Mandatory = $false)]
$numOfSelfProvisionedAgents,
[ValidateSet('changeActive', 'useFile', '')]
$activeRunSettings,
[String]
$runSettingName,
[String]
$testContextParameters
)

#Set the userAgent appropriately based on whether the task is running as part of a ci or cd
if($Env:SYSTEM_HOSTTYPE -ieq "build") {
    $userAgent = "CloudLoadTestBuildTask"
}
else {
    $userAgent = "CloudLoadTestReleaseTask"
}
$global:apiVersion = "api-version=1.0"
$global:ScopedTestDrop = $TestDrop
$global:RunTestSettingsFile = $TestSettings
$ThresholdExceeded = $false
$MonitorThresholds = $false

function InitializeRestHeaders()
{
	$restHeaders = New-Object -TypeName "System.Collections.Generic.Dictionary[[String], [String]]"
	if([string]::IsNullOrWhiteSpace($connectedServiceName))
	{
		$patToken = Get-AccessToken $connectedServiceDetails
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

function Get-AccessToken($vssEndPoint) 
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
. $PSScriptRoot/ContextParametersHelper.ps1

############################################## PS Script execution starts here ##########################################
WriteTaskMessages "Starting Load Test Script"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DTA"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

Write-Output "Test settings = $TestSettings"
Write-Output "Test drop = $TestDrop"
Write-Output "Load test = $LoadTest"
Write-Output "Run Settings Name = $runSettingName"
Write-Output "Active Run Settings = $activeRunSettings"
Write-Output "Run Test Parameters $testContextParameters"
Write-Output "Load generator machine type = $MachineType"
Write-Output "Self-provisioned rig = $resourceGroupName"
Write-Output "Num of agents = $numOfSelfProvisionedAgents"
Write-Output "Run source identifier = build/$env:SYSTEM_DEFINITIONID/$env:BUILD_BUILDID"

#Validate Input
ValidateInputs $env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI $connectedServiceName $TestSettings $TestDrop $LoadTest

ValidateRunSettingsInputs $global:ScopedLoadTest $activeRunSettings $runSettingName

#Setting monitoring of Threshold rule appropriately
if ($ThresholdLimit -and $ThresholdLimit -ge 0)
{
	$MonitorThresholds = $true
	Write-Output "Threshold limit = $ThresholdLimit"
}

Set-RunSettings $global:ScopedLoadTest $activeRunSettings $runSettingName $testContextParameters

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
	Write-Output "Test Drop Source Location: $global:ScopedTestDrop"
	UploadTestDrop $drop $global:ScopedTestDrop
	WriteTaskMessages ("Uploading test files took {0}. Queuing the test run." -f $($elapsed.Elapsed.ToString()))

	#Queue the test run
	$runJson = ComposeTestRunJson $LoadTest $drop.id $MachineType $resourceGroupName $numOfSelfProvisionedAgents

	$run = QueueTestRun $headers $runJson $CltAccountUrl
	MonitorAcquireResource $headers $run $CltAccountUrl

	#Monitor the test run
	$elapsed = [System.Diagnostics.Stopwatch]::StartNew()
	$thresholdExceeded = MonitorTestRun $headers $run $CltAccountUrl $MonitorThresholds
	WriteTaskMessages ( "Run execution took {0}. Collecting results." -f $($elapsed.Elapsed.ToString()))

	#Print the error and messages
	$run = GetTestRun $headers $run.id $CltAccountUrl
	ShowMessages $headers $run $CltAccountUrl
	$thresholdsViolatedCount = PrintErrorSummary $headers $run $CltAccountUrl $MonitorThresholds

	if ($run.state -ne "completed")
	{
		Write-Error "Load test has failed. Please check error messages to fix the problem."
	}
	elseif ($thresholdExceeded -eq $true)
	{
		Write-Error "Load test task is marked as failed, as the number of threshold errors has exceeded permissible limit."
	}
	else
	{
		WriteTaskMessages "The load test completed successfully."
	}

	$run = GetTestRun $headers $run.id $CltAccountUrl
	$webResultsUri = $run.WebResultUrl
	
	Write-Output ("Run-id for this load test is {0} and its name is '{1}'." -f  $run.runNumber, $run.name)	
	Write-Output ("To view run details navigate to {0}" -f $webResultsUri)
	Write-Output "To view detailed results navigate to Load Test | Load Test Manager in Visual Studio IDE, and open this run."

	$resultsMDFolder = New-Item -ItemType Directory -Force -Path "$env:Temp\LoadTestResultSummary"
	$resultFilePattern = ("CloudLoadTestResults_{0}_{1}_*.md" -f $env:AGENT_ID, $env:SYSTEM_DEFINITIONID)
	$excludeFilePattern = ("CloudLoadTestResults_{0}_{1}_{2}_*.md" -f $env:AGENT_ID, $env:SYSTEM_DEFINITIONID, $env:BUILD_BUILDID)
	Remove-Item $resultsMDFolder\$resultFilePattern -Exclude $excludeFilePattern -Force
	$summaryFile =  ("{0}\CloudLoadTestResults_{1}_{2}_{3}_{4}.md" -f $resultsMDFolder, $env:AGENT_ID, $env:SYSTEM_DEFINITIONID, $env:BUILD_BUILDID, $run.id)
	
	if ($thresholdExceeded -eq $true)
	{
		$thresholdMessage=("{0} thresholds violated." -f $thresholdsViolatedCount)
		$thresholdImage="bowtie-status-error"
		$thresholdImageLabel="Error"
	}
	elseif ($thresholdsViolatedCount -gt 1)
	{
		$thresholdMessage=("{0} thresholds violated." -f $thresholdsViolatedCount)
		$thresholdImage="bowtie-status-warning"
		$thresholdImageLabel="Warning"
	}
	elseif ($thresholdsViolatedCount -eq 1)
	{
		$thresholdMessage=("{0} threshold violated." -f $thresholdsViolatedCount)
		$thresholdImage="bowtie-status-warning"
		$thresholdImageLabel="Warning"
	}
	else
	{
		$thresholdMessage="No thresholds violated."
		$thresholdImage="bowtie-status-success"
		$thresholdImageLabel="Success"
	}
	
	
	$summary = ('<span class="bowtie-icon {3}" role="img" aria-label="{5}" />   {4}<br/><a href="{1}" target="_blank">Test Run: {0}</a> using {2}.' -f  $run.runNumber, $webResultsUri , $run.name, $thresholdImage, $thresholdMessage, $thresholdImageLabel)
	('<p>{0}</p>' -f $summary) | Out-File  $summaryFile -Encoding ascii -Append
	UploadSummaryMdReport $summaryFile
}
else
{
	Write-Error ("Connection '{0}' failed for service '{1}'" -f $connectedServiceName, $connectedServiceDetails.Url.AbsoluteUri)
}

WriteTaskMessages "Load Test Script execution completed"

