Class ThresholdRule
{
	[string]$counterInstanceName
	[bool]$isHigherBetter
	[float]$thresholdValue
}

function ValidateThresholdRule($cltAccountUrl,$headers,[ThresholdRule]$thresholdRule,$testRunId)
{
 $counterInstances = Get-CounterInstances $cltAccountUrl $headers $testRunId
 return ValidateThreshold $cltAccountUrl $headers $thresholdRule $testRunId $counterInstances
}

function ValidateThreshold($cltAccountUrl,$headers,[ThresholdRule]$thresholdRule,$testRunId,$counterInstances)
{
 $counterInstanceId = GetCounterInstanceId $counterInstances $thresholdRule.counterInstanceName
 $samplesRemaining = $true
 $startInterval = 0
 $endInterval = 2000
 $violationCount = 0
 While($samplesRemaining -eq $true)
 {
  $samples = Get-Samples $cltAccountUrl $headers $testRunId $counterInstanceId $startInterval $endInterval
  if($samples -and $samples.count -gt 0)
  {
   $newViolations =  GetViolationsCount $samples $thresholdRule.thresholdValue $thresholdRule.isHigherBetter
   $violationCount = $violationCount + $newViolations
  }
  if($samples.count -ne 2000)
  {
   $samplesRemaining = $false
  }
 }
 return $violationCount
}

function GetViolationsCount($samples, $thresholdValue, $isHigherBetter)
{
 if($isHigherBetter -eq $false)
 {
 $thresholdviolatedSamples = $samples.values.values.computedValue -gt $thresholdValue
 }
 else
 {
 $thresholdviolatedSamples = $samples.values.values.computedValue -lt $thresholdValue
 }
 return $thresholdviolatedSamples.count
}


function GetCounterInstanceId($counterInstances,$counterName)
{
 ForEach($counterInstance in $counterInstances.value)
 {
  if($counterInstance.counterName -eq $thresholdRule.counterInstanceName)
  {
   $counterInstanceId = $counterInstance.counterInstanceId
  }
 }
 return $counterInstanceId
}

function Get-Samples($cltAccountUrl,$headers,$testRunId,$counterInstanceId,$startInterval,$endInterval)
{
$getSamplesBody = ComposeGetSamples $counterInstanceId $startInterval $endInterval
$getSamplesUri = [string]::Format("{0}/_apis/clt/testruns/{1}/CounterSamples?api-version=1.0", $cltAccountUrl, $testRunId)
return InvokeRestMethod -Uri $getSamplesUri -contentType "application/json" -headers $headers -Method Post -body $getSamplesBody
}

function ComposeGetSamples($counterInstanceId,$fromInterval,$toInterval)
{
$getsamplesjson = @"
	{
		"count": 1,
		"value":[
                 {
			"counterInstanceId":"$counterInstanceId",
			"fromInterval":$fromInterval,
			"toInterval":$toInterval
                 }
                ]
		}
"@

return $getsamplesjson

}

function Get-CounterInstances($cltAccountUrl,$headers,$testRunId)
{
 $getCounterInstancesUri = [string]::Format("{0}/_apis/clt/testruns/{1}/CounterInstances?groupNames=Default", $cltAccountUrl, $testRunId)
 return InvokeRestMethod -Uri $getCounterInstancesUri -contentType "application/json" -headers $headers -Method Get
}


function CreateAvgResponseTimeThresholdRule($avgResponseTimeThreshold)
{
	if ($avgResponseTimeThreshold -eq 0)
    {
	  return null
	}

	if((isNumericValue $avgResponseTimeThreshold) -ne $true)
	{
	 throw "Avg. Response Time threshold should be a numeric value.Please specify a valid threshold value and try again "
	}

	$thresholdRule = New-Object ThresholdRule
	$thresholdRule.counterInstanceName = "Avg. Response Time"
	$thresholdRule.isHigherBetter = $false
	$thresholdRule.thresholdValue = $avgResponseTimeThreshold/1000
	return $thresholdRule
}