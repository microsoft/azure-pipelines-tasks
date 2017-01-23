[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1


# This test ensures the top level functionality of the task is invoked


# Arrange   
Register-Mock InvokeMSBuildRunnerPostTest 
Register-Mock CreateAndUploadReport 
Register-Mock BreakBuildOnQualityGateFailure 

# Act
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\SonarQubePostTest.ps1    

# Assert
Assert-WasCalled InvokeMSBuildRunnerPostTest
Assert-WasCalled CreateAndUploadReport
Assert-WasCalled BreakBuildOnQualityGateFailure

