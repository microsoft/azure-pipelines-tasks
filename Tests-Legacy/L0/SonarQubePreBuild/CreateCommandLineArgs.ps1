[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePreBuild\Common\SonarQubeHelpers\SonarQubeHelper.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePreBuild\SonarQubePreBuildImpl.ps1


## Test Case 1 - Minimum configuration 

# Act
$actual = CreateCommandLineArgs `
                -projectKey "pkey" `
                -projectName "Test Project" `
                -projectVersion "1.0" `
                -serverUrl "http://localhost:9000" `                
               

# Assert.
Assert-AreEqual 'begin /k:"pkey" /n:"Test Project" /v:"1.0" /d:sonar.host.url="http://localhost:9000"' $actual


## Test Case 2 - Full configuration 

# Arrange
$dummyConfigFile = [System.IO.Path]::Combine($PSScriptRoot, "test-analysis-config.xml");
New-Item $dummyConfigFile -ItemType File -Force 
$oldSourcesValue = $env:BUILD_SOURCESDIRECTORY 
$env:BUILD_SOURCESDIRECTORY = "d:\agent\_work\1\s"

try
{
    # Act
    $actual = CreateCommandLineArgs `
                -projectKey "pkey" `
                -projectName "Test Project" `
                -projectVersion "1.0" `
                -serverUrl "http://localhost:9000" `
                -serverUsername "admin" `
                -serverPassword "ad&min" `
                -dbUrl "db" `
                -dbUsername "dbUserName" `
                -dbPassword "dbPassword" `
                -additionalArguments "/d:sonar.branch=master /d:sonar.scm=tfvc" `
                -configFile $dummyConfigFile
}
finally
{
    Remove-Item $dummyConfigFile
    $env:BUILD_SOURCESDIRECTORY = $oldSourcesValue
}                

# Assert.
Assert-AreEqual ('begin /k:"pkey" /n:"Test Project" /v:"1.0" /d:sonar.host.url="http://localhost:9000" /d:sonar.login="admin" /d:sonar.password="ad&min" /d:sonar.jdbc.url="db" /d:sonar.jdbc.username="dbUserName" /d:sonar.jdbc.password="dbPassword" /d:sonar.branch=master /d:sonar.scm=tfvc /s:"' +$dummyConfigFile + '"') $actual


# Test Case 3 - missing host url results in a user friendly exception
Assert-Throws { CreateCommandLineArgs -projectKey "pkey" -projectName "Test Project" -projectVersion "1.0" } "Please setup a generic endpoint and specify the SonarQube Url as the Server Url" 









