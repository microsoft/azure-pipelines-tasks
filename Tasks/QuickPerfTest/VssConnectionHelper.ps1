function Get-CltEndpoint($vssConnection, $headers)
{

  # Load all dependent files for execution
  . $PSScriptRoot/CltTasksUtility.ps1

 $vsoUrl = $vssConnection.Url.AbsoluteUri.TrimEnd('/')
 Write-Output "Fetching the Clt endpoint for $vsoUrl"
 $spsLocation = Get-SpsLocation($vsoUrl, $spsLocationCallJson, $headers)
 $cltLocation = Get-CltLocation($spsLocation, $cltLocationCallJson)

 return $cltLocation

}

function Get-SpsLocation($vsoUrl, $headers)
{
	$spsUniqueIdentifier = "951917AC-A960-4999-8464-E3F0AA25B381"
    return Get-ServiceLocation($vsoUrl, $headers, $spsUniqueIdentifier)
}

function Get-CltLocation($spsUrl, $headers)
{
    $cltUniqueIdentifier = "6C404D78-EF65-4E65-8B6A-DF19D6361EAE"
    return Get-ServiceLocation($spsUrl, $headers, $cltUniqueIdentifier)
}

function Get-ServiceLocation($baseUrl, $headers, $serviceUniqueIdentifier)
{
	# Load all dependent files for execution
  . $PSScriptRoot/CltTasksUtility.ps1

    $locationCallUri = ("{0}/_apis/servicedefinitions/LocationService2/{1}" -f $baseUrl, $serviceUniqueIdentifier)
    $locationCallJsonResponse = (InvokeRestMethod -Uri $locationCallUri -contentType "application/json" -headers $headers -Method Get) |ConvertFrom-Json

	if($locationCallJsonResponse)
	{
	return ($locationCallJsonResponse.locationMappings |Select-Object -First 1).location
	}
	return $null
}