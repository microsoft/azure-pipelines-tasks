[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

Register-Mock InvokeVsTestCmdletHasMember { return $true } -- -memberName "DiagFileName"
Register-Mock Get-ChildItem { $false } -- -path 'env:system_debug' -erroraction silent

$vstestVersion = "15"

. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1
$enableDiag = ShouldAddDiagFlag $vstestVersion
Assert-AreEqual $enableDiag $false