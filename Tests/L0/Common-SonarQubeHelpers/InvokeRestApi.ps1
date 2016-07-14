[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubeHelpers\SonarQubeHelper.ps1

# Common setup
Register-Mock GetTaskContextVariable  { 'http://testsqserver:9999' } -- 'MSBuild.SonarQube.HostUrl'
Register-Mock Invoke-RestMethod # Hijack the PowerShell function used to make REST calls


# Test case 1: unauthenticated users can make calls to the SQ server

# Act - no credentials
InvokeGetRestMethod -query "/api/test"         

# Assert
Assert-WasCalled Invoke-RestMethod -ParametersEvaluator { 
                        $Uri -eq 'http://testsqserver:9999/api/test' -and
                        $Method -eq 'Get' -and
                        $Headers -eq $null     # no (auth) headers
                        }

Unregister-Mock Invoke-RestMethod

# Test case 2: authenticated users can make authenticated calls to the SQ server

Register-Mock GetTaskContextVariable  { 'user' } -- "MSBuild.SonarQube.ServerUsername"
Register-Mock GetTaskContextVariable  { 'pa$$word' } -- "MSBuild.SonarQube.ServerPassword"
Register-Mock Invoke-RestMethod

# Act
InvokeGetRestMethod -query "/api/test"               

# Assert
Assert-WasCalled Invoke-RestMethod -ParametersEvaluator { 
                        $Uri -eq 'http://testsqserver:9999/api/test' -and
                        $Method -eq 'Get' -and
                        $Headers.Count -eq 1 -and
                        $Headers['Authorization'] -eq 'Basic dXNlcjpwYSQkd29yZA==' #this is base64 slang for 'user:pa$$word'
                        }

Unregister-Mock Invoke-RestMethod