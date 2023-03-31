[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

# Test 1 "Check SkiCACheck flag value"
$result = Get-SkipCACheckOption -SkipCACheck "true"
Assert-AreEqual "-SkipCACheck" $result

# Test 2 "Should return '' if passed false"
$result = Get-SkipCACheckOption -SkipCACheck "false"
Assert-IsNullOrEmpty $result "SkipCACheck Should be empty"