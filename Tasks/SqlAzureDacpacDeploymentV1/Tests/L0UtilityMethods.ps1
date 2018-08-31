[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

#path to Utility.ps1 for SqlAzureDacpacDeployment task
. "$PSScriptRoot\..\Utility.ps1"

$passwordWithEscapeChar = EscapeSpecialChars -str $sqlPasswordSpecialCharacter
Assert-AreEqual  $sqlPasswordEscapedSpecialCharacter $passwordWithEscapeChar
