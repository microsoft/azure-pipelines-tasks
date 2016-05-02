[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePreBuild\Common\SonarQubeHelpers\SonarQubeHelper.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePreBuild\SonarQubePreBuildImpl.ps1


function RunTest
{
    param([string]$existingArgs, [bool]$isPrBuild, [string]$sqVersion, [string]$expectedArgs, [string]$message)
    
    # Arrange
    Register-Mock IsPrBuild {$isPrBuild}
    Register-Mock InvokeGetRestMethod {$sqVersion} -- "/api/server/version" 
    Register-Mock GetTaskContextVariable {$null} -- "MSBuild.SonarQube.ServerVersion" 

    # Act
    $newArgs = UpdateArgsForPullRequestAnalysis $existingArgs

    # Assert
    Assert-AreEqual $expectedArgs $newArgs $message
    
    # Cleanup
    Unregister-Mock InvokeGetRestMethod
    Unregister-Mock IsPrBuild
    Unregister-Mock GetTaskContextVariable
}


RunTest -existingArgs "/d:arg1 arg2" `
        -isPrBuild $false `
        -sqVersion "4.6" `
        -expectedArgs "/d:arg1 arg2" `
        -message "Args should not get updated on non-PR builds"


RunTest -existingArgs "/d:arg1 arg2" `
        -isPrBuild $true `
        -sqVersion "4.6" `
        -expectedArgs "/d:arg1 arg2 /d:sonar.analysis.mode=incremental" `
        -message "SonarQube 5.1 and lower should be configured with sonar.analysis.mode=incremental on PR builds"


RunTest -existingArgs "" `
        -isPrBuild $true `
        -sqVersion "5.2" `
        -expectedArgs " /d:sonar.analysis.mode=issues /d:sonar.report.export.path=sonar-report.json" `
        -message "SonarQube 5.2+ be configured with sonar.analysis.mode=incremental on PR builds"

RunTest -existingArgs "/s:foo.txt" `
        -isPrBuild $true `
        -sqVersion "5.3-SNAPSHOT" `
        -expectedArgs "/s:foo.txt /d:sonar.analysis.mode=issues /d:sonar.report.export.path=sonar-report.json" `
        -message "Simple semantic versioning is supported, i.e. version-description"







