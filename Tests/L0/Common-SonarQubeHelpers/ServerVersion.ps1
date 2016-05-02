[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubeHelpers\SonarQubeHelper.ps1

$distributedTaskContext = 'Some distributed task context'

function VerifyVersionComparison
{
    param ([string]$inputVersion, [int]$expectedComparisonResult)
    
    Register-Mock Get-TaskVariable { $inputVersion } -- -Context $distributedTaskContext -Name 'MSBuild.SonarQube.Internal.ServerVersion'
    
    $result = CompareSonarQubeVersionWith52 
    
    if ($expectedComparisonResult -lt 0)
    {
        Assert-AreEqual $true ($result -lt 0) "Expecting $inputVersion to be lower than 5.2"
    }
    elseif ($expectedComparisonResult -gt 0)
    {
         Assert-AreEqual $true ($result -gt 0) "Expecting $inputVersion to be greater than 5.2"
    }
    else
    {
         Assert-AreEqual $true ($result -eq 0) "Expecting $inputVersion to be equal to 5.2"
    }
    
    Unregister-Mock Get-TaskVariable
} 

VerifyVersionComparison "4.5.2" -1
VerifyVersionComparison "4.5.2.1" -1
VerifyVersionComparison "1.0" -1
VerifyVersionComparison "4.5.6-SNAPSHOT" -1

VerifyVersionComparison "5.6" 1
VerifyVersionComparison "5.6.1" 1
VerifyVersionComparison "5.6.1.0" 1
VerifyVersionComparison "5.6-DEV" 1
VerifyVersionComparison "5.2.1" 1

VerifyVersionComparison "5.2" 0
VerifyVersionComparison "5.2-SNAPSHOT" 0

