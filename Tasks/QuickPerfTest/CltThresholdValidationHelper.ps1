function GetResultsSummary($cltAccountUrl,$headers,$testRunId)
{
	$getResultsSummaryUri = [string]::Format("{0}/_apis/clt/testRuns/{1}/ResultSummary", $cltAccountUrl, $testRunId)
	$resultsSummary = InvokeRestMethod -Uri $getResultsSummaryUri -contentType "application/json" -headers $headers -Method Get 
	if($resultsSummary -eq $null)
	{
		throw "Unable to fetch the result summary for the run"
	}
	return $resultsSummary
}

function ValidateAvgResponseTimeThresholdInput($avgResponseTimeThreshold)
{
	if ($avgResponseTimeThreshold -eq 0)
	{
		return $null
	}

	if(((IsNumericValue $avgResponseTimeThreshold) -ne $true) -or [System.Int32]$avgResponseTimeThreshold -lt 0)
	{
		throw "Avg. Response Time threshold should be a positive numeric value.Please specify a valid threshold value and try again "
	}
	return $avgResponseTimeThreshold
}

function ValidateAvgResponseTimeThreshold($cltAccountUrl,$headers,$testRunId,$avgResponseTimeThreshold)
{
	$resultsSummary = GetResultsSummary  $cltAccountUrl  $headers $testRunId
	if($resultsSummary -and $resultsSummary.overallRequestSummary -and $resultsSummary.overallRequestSummary.averageResponseTime)
	{
		return ($resultsSummary.overallRequestSummary.averageResponseTime -lt ($avgResponseTimeThreshold/1000))
	}
	else
	{
		throw "Unable to fetch the result summary for the run"
	}
}