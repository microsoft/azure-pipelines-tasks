[CmdletBinding()]
param()


. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubehelpers\SonarQubeHelper.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\SonarQubeMetrics.ps1
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

# E2E test - waiting for the SQ analysis to complete and querying for the quality gate status

# Arrange 

#Register-Mock Get-TaskVariable { $null } -- -Context $distributedTaskContext -Name 'MSBuild.SonarQube.QualityGateStatus'
Register-Mock CompareSonarQubeVersionWith52 { 1 } # SQ version is greater than 5.2 
Register-Mock GetSonarScannerDirectory { "$PSScriptRoot\data\MetricsTest" }
Register-Mock SetTaskContextVariable

# to wait for the SQ task to complete, an /api/ce/task is polled until the response is task.status is "success" 
$taskStatusResponse = ConvertFrom-Json '{"task":{"id":"AVQFkrko8fxuJtveJbjv","type":"REPORT","componentId":"AVQFkrko8fxuJtveJbjv","componentKey":"blm5","componentName":"Backlogmaps","componentQualifier":"TRK","analysisId":"10337","status":"SUCCESS","submittedAt":"2016-04-12T10:29:33+0100","startedAt":"2016-04-12T10:29:35+0100","executedAt":"2016-04-12T10:29:39+0100","executionTimeMs":3968,"logs":true}}'

# the task id below is the one in the report-task.txt file
Register-Mock InvokeGetRestMethod {$taskStatusResponse} -- "/api/ce/task?id=AVQFkrko8fxuJtveJbjv" 

# the analysis id below comes from the task status reponse
$qualityGateResponse = ConvertFrom-Json '{"projectStatus":{"status":"OK","conditions":[],"periods":[]}}'
Register-Mock InvokeGetRestMethod {$qualityGateResponse} -- "/api/qualitygates/project_status?analysisId=10337" 

# Act

# Act 1 - calling GetOrFetchQualityGateStatus without first calling WaitForAnalysisToFinish fails
Assert-Throws {GetOrFetchQualityGateStatus} "*WaitForAnalysisToFinish*"
 
# Act 2- wait for the analysis to finish and query the quality gate status
WaitForAnalysisToFinish
Assert-WasCalled SetTaskContextVariable -- 'MSBuild.SonarQube.AnalysisId' '10337'  
$actualStatus = GetOrFetchQualityGateStatus

Assert-WasCalled InvokeGetRestMethod -Times 1 -- "/api/qualitygates/project_status?analysisId=10337"

# Act 3- query again and assert that we don't hit the server with a REST API call
$actualStatus = GetOrFetchQualityGateStatus
Assert-WasCalled InvokeGetRestMethod -Times 1 -- "/api/qualitygates/project_status?analysisId=10337"

# Assert

Assert-AreEqual "OK" $actualStatus

# make sure that the quality gate status is set in build variables
Assert-WasCalled SetTaskContextVariable -- 'MSBuild.SonarQube.QualityGateStatus' 'OK'

# Cleanup
Unregister-Mock Get-TaskVariable 
Unregister-Mock CompareSonarQubeVersionWith52  
Unregister-Mock GetSonarScannerDirectory 
Unregister-Mock SetTaskContextVariable
Unregister-Mock InvokeGetRestMethod
