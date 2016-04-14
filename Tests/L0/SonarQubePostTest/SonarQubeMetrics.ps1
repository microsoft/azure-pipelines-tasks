[CmdletBinding()]
param()


. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubehelpers\SonarQubeHelper.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\SonarQubeMetrics.ps1
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$distributedTaskContext = "context"

# Test 1 - this test ensures the quality gate status is read from the build variable MSBuild.SonarQube.QualityGateStatus if it exists

# Arrange   
Register-Mock Get-TaskVariable { "OK" } -- -Context $distributedTaskContext -Name 'MSBuild.SonarQube.QualityGateStatus'

# Act
$actualStatus = GetOrFetchQualityGateStatus

# Assert
Assert-AreEqual "OK" $actualStatus "The cached quality gate status should be returned" 

# Cleanup
Unregister-Mock Get-TaskVariable

# Test 2 - this goes through the whole E2E - waiting for the SQ analysis to complete and querying for the quality gate status

# Arrange 
Register-Mock Get-TaskVariable { $null } -- -Context $distributedTaskContext -Name 'MSBuild.SonarQube.QualityGateStatus'
Register-Mock CompareSonarQubeVersionWith52 { 1 } # SQ version is greater than 5.2 
Register-Mock GetSonarScannerDirectory { "$PSScriptRoot\data\MetricsTest" }
Register-Mock SetTaskContextVariable

# to wait for the SQ task to complete, an /api/ce/task is polled until the response is task.status is "success" 
$taskStatusResponse = ConvertFrom-Json '{"task":{"id":"AVQFkrko8fxuJtveJbjv","type":"REPORT","componentId":"AVQFkrko8fxuJtveJbjv","componentKey":"blm5","componentName":"Backlogmaps","componentQualifier":"TRK","analysisId":"10337","status":"SUCCESS","submittedAt":"2016-04-12T10:29:33+0100","startedAt":"2016-04-12T10:29:35+0100","executedAt":"2016-04-12T10:29:39+0100","executionTimeMs":3968,"logs":true}}'

# the task id below is the one in the report-task.txt file
Register-Mock InvokeGetRestMethod {$taskStatusResponse} -- "/api/ce/task?id=AVQFkrko8fxuJtveJbjv" $true

# the analysis id below comes from the task status reponse
$qualityGateResponse = ConvertFrom-Json '{"projectStatus":{"status":"OK","conditions":[],"periods":[]}}'
Register-Mock InvokeGetRestMethod {$qualityGateResponse} -- "/api/qualitygates/project_status?analysisId=10337" $true

# Act 1 - calling GetOrFetchQualityGateStatus without first calling WaitForAnalysisToFinish fails
Assert-Throws {GetOrFetchQualityGateStatus} "*WaitForAnalysisToFinish*"
 
WaitForAnalysisToFinish
Assert-WasCalled SetTaskContextVariable -- 'MSBuild.SonarQube.AnalysisId' '10337' 
Register-Mock GetTaskContextVariable {'10337'} -- 'MSBuild.SonarQube.AnalysisId' 
$actualStatus = GetOrFetchQualityGateStatus

# Assert
Assert-AreEqual "OK" $actualStatus
# make sure the analysis id and the quality gate status are set in build variables

Assert-WasCalled SetTaskContextVariable -- 'MSBuild.SonarQube.QualityGateStatus' 'OK'

# Cleanup
Unregister-Mock Get-TaskVariable 
Unregister-Mock CompareSonarQubeVersionWith52  
Unregister-Mock GetSonarScannerDirectory 
Unregister-Mock SetTaskContextVariable
Unregister-Mock InvokeGetRestMethod
