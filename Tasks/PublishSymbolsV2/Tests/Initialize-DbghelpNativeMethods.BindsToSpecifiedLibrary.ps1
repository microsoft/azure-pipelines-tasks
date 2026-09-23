[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\IndexHelpers\DbghelpFunctions.ps1
$dbghelpPath = "SomeDrive:\AgentHome\Tools\dbghelp.dll"

# Act.
Initialize-DbghelpNativeMethods -DbghelpPath $dbghelpPath

# Assert.
$method = [IndexHelpers.Dbghelp.NativeMethods].GetMethod('SymInitialize')
$attribute = $method.GetCustomAttributes([System.Runtime.InteropServices.DllImportAttribute], $false)[0]
Assert-AreEqual $dbghelpPath $attribute.Value
