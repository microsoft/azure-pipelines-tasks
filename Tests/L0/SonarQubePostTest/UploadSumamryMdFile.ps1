[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\SonarQubePostTestImpl.ps1

    
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


#### Test 1 - Uploading fails with a warning if the file is not found
    
# Arrange
Register-Mock GetSonarQubeOutDirectory {([IO.Path]::GetRandomFileName())}
Register-Mock Write-Warning 

# Act
UploadSummaryMdReport

# Assert
Assert-WasCalled Write-Warning 

# Cleanup
Unregister-Mock  GetSonarQubeOutDirectory
Unregister-Mock  Write-Warning


#### Test 2 - Happy path: the command responsible for uploading the summary report is called  

# Arrange
  
$tempDir = CreateRandomDir
$dummyReport = [IO.Path]::Combine($tempDir, "summary.md") 
$file = [IO.File]::Create($dummyReport)   

Register-Mock GetSonarQubeOutDirectory {$tempDir}
Register-Mock Write-Host

# Act
UploadSummaryMdReport

# Assert
Assert-WasCalled Write-Host -ArgumentsEvaluator { $args[0].StartsWith("##vso[task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report;") }

# Cleanup
$file.Dispose()
[IO.Directory]::Delete($tempDir, $true)    
Unregister-Mock  GetSonarQubeOutDirectory
Unregister-Mock  Write-Host 
 


