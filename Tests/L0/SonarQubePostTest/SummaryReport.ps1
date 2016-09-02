[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubehelpers\SonarQubeHelper.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\SummaryReport\ReportBuilder.ps1
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
    
function CreateRandomDir
{
   $tempDirectory = [IO.Path]::Combine([IO.Path]::GetTempPath(), [IO.Path]::GetRandomFileName());
   
   if ([IO.Directory]::Exists($tempDirectory))
   {
       [IO.Directory]::Delete($tempDirectory, $true)
   }
   
   [void][IO.Directory]::CreateDirectory($tempDirectory);
   return $tempDirectory 
}

function VerifyMessage
{
    param ($actualMessage, $expectedStatus, $expectedValue, $expectedThreshold, $expectedName, $expectedComparator)
    
    Write-Host "Verifying $($actualMessage.metric_name)"
    
    Assert-AreEqual $expectedName $actualMessage.metric_name "Invalid message threshold"
    Assert-AreEqual $expectedStatus $actualMessage.status "Invalid message status"
    Assert-AreEqual $expectedValue $actualMessage.actualValue "Invalid message value"
    Assert-AreEqual $expectedThreshold $actualMessage.threshold "Invalid message threshold"    
    Assert-AreEqual $expectedComparator $actualMessage.comparator "Invalid message comparator"    
}

#### Test 1 - Legacy report - uploading fails with a warning if the file is not found
    
# Arrange
Register-Mock GetSonarQubeOutDirectory {([IO.Path]::GetRandomFileName())}
Register-Mock Write-Warning 
Register-Mock IsPrBuild {$true}  

# Act
CreateAndUploadReport

# Assert
Assert-WasCalled Write-Warning 

# Cleanup
Unregister-Mock GetSonarQubeOutDirectory
Unregister-Mock Write-Warning
Unregister-Mock IsPrBuild   


#### Test 2 - Legacy report upload: the command responsible for uploading the summary report is called  

# Arrange
  
$tempDir = CreateRandomDir
$dummyReport = [IO.Path]::Combine($tempDir, "summary.md") 
$file = [IO.File]::Create($dummyReport)   

Register-Mock GetSonarQubeOutDirectory {$tempDir}
Register-Mock Write-Host
Register-Mock IsPrBuild {$false}  
# the legacy report is printed if the user deselects the full report option
Register-Mock GetTaskContextVariable {$false} -- "MSBuild.SonarQube.IncludeReport" 

# Act
CreateAndUploadReport

# Assert
Assert-WasCalled Write-Host -ArgumentsEvaluator { $args[0].StartsWith("##vso[task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report;") }

# Cleanup
$file.Dispose()
[IO.Directory]::Delete($tempDir, $true)    
Unregister-Mock GetSonarQubeOutDirectory
Unregister-Mock Write-Host 
Unregister-Mock IsPrBuild   


### Test 3 - Fetching the quality gate warnings and errors
$qualityGateResponse = Get-Content "$PSScriptRoot\data\ReportTest\qualityGateResponse.json" | Out-String | ConvertFrom-Json
$metricsResponse = Get-Content "$PSScriptRoot\data\ReportTest\metricsResponse.json" | Out-String | ConvertFrom-Json
Register-Mock FetchMetricNames {$metricsResponse.metrics}

# Act
$messages = GetQualityGateWarningsAndErrors $qualityGateResponse

# Assert

$messages = $messages | Sort-Object 'status', 'metric_name'
Assert-AreEqual $messages.Count 4 "There should be 3 errors and 1 warning"

VerifyMessage $messages[0] "error" "0%" "5%" "Duplicated blocks" "&#60;" # lower than
VerifyMessage $messages[1] "error" "5h 22min" "8h" "Technical Debt on new code" "&#8800;" # 322 minutes is 5h and the operator is not equals
VerifyMessage $messages[2] "error" "59min" "0min" "Technical Debt on new code 2" "&#62;" # 322 minutes is 5h and the operator is not equals
VerifyMessage $messages[3] "warn" "0" "0" "Blocker issues" "&#61;" # equals
