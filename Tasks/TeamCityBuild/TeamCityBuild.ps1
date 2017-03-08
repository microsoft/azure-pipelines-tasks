param(
	$connectedServiceName, $buildType, $shelvesetName, $workingFolder, $customRunnerPath
)

function GetEndpointData{
	param([string][ValidateNotNullOrEmpty()]$connectedServiceName)
	$serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName
	if (!$serviceEndpoint)
	{
		throw "A Connected Service with name '$ConnectedServiceName' could not be found.  Ensure that this Connected Service was successfully provisioned using the services tab in the Admin UI."
	}
	return $serviceEndpoint
}
function TriggerError ($errorMsg) {
      if($LASTEXITCODE -ne 0){throw " Action faild !  $errorMsg"}
            else {
                 Write-Host "Build trigged successfully"
            }
    }
if (!$customRunnerPath) {
	$runner = "C:\Python27\python.exe";
}
else {
	$runner = $customRunnerPath;
}

$serviceEndpoint = GetEndpointData $connectedServiceName;
$password = $($serviceEndpoint.Authorization.Parameters.Password)
$username =$($serviceEndpoint.Authorization.Parameters.UserName)
$url = $($serviceEndpoint.Url)

Write-Host "Triggering Build ... "
Write-Host "service URL		: $url"
Write-Host "service User Name	: $username"
Write-Host "service Password	: $password"
Write-Host "TeamCity Build Type	: $buildType"
Write-Host "python runner path	: $runner"
Write-Host "Build Triggered ... Waiting for TeamCity Server return code ...(from: $url)"
Write-Host "When this build completes you will find the hyperlink to TeamCity build in the summary page."
$result = Invoke-Command -ScriptBlock { cmd /c "$runner TeamCityBuild.py $url $buildType $shelvesetName $username $password $workingFolder 2>&1"}
$linkMarkdownFile = "$workingFolder\TeamCityBuild.md".Replace("\","\\\\"); 
Write-Host "adding markdown file: $linkMarkdownFile";
Write-Host "##vso[task.addattachment type=Distributedtask.Core.Summary;name=Team City Build;]$linkMarkdownFile";
TriggerError -errorMsg "$result"
$parsed = $result.replace("...","...`r`n")
Write-Host "$parsed"
