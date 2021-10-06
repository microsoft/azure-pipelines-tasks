[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Get-VSPath.ps1

Register-Mock Get-ItemProperty { @{ShellFolder = 'use_reg_key'} } -- -LiteralPath HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0 -Name ShellFolder -ErrorAction Ignore
Register-Mock Get-ItemProperty { @{ShellFolder = 'use_reg_key'} } -- -LiteralPath HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\12.0 -Name ShellFolder -ErrorAction Ignore
Register-Mock Get-ItemProperty { @{ShellFolder = 'use_reg_key'} } -- -LiteralPath HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\11.0 -Name ShellFolder -ErrorAction Ignore
Register-Mock Get-ItemProperty { @{ShellFolder = 'use_reg_key'} } -- -LiteralPath HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\10.0 -Name ShellFolder -ErrorAction Ignore

# Aсt.
$path_14 = Get-VSPath '14.0'
$path_12 = Get-VSPath '12.0'
$path_11 = Get-VSPath '11.0'
$path_10 = Get-VSPath '10.0'

# Assert.
Assert-AreEqual 'use_reg_key' $path_14
Assert-AreEqual 'use_reg_key' $path_12
Assert-AreEqual 'use_reg_key' $path_11
Assert-AreEqual 'use_reg_key' $path_10
