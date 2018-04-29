[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

$tmNames = @('machine1 ',' machine2 : 123','2.2.2.2', '3.3.3.3 :5987')
$cred = $null
$auth = 'Default'
$configuration = 'microsoft.powershell'

$tms = & $module Get-TargetMachines $tmNames $cred $auth $configuration -UseSsl

Assert-AreEqual $tmNames.Count $tms.Count

Assert-AreEqual $tms[0].computerName 'machine1'
Assert-AreEqual $tms[0].WSManPort '5986'

Assert-AreEqual $tms[1].computerName 'machine2'
Assert-AreEqual $tms[1].WSManPort '123'

Assert-AreEqual $tms[2].computerName '2.2.2.2'
Assert-AreEqual $tms[2].WSManPort '5986'

Assert-AreEqual $tms[3].computerName '3.3.3.3'
Assert-AreEqual $tms[3].WSManPort '5987'

$tms = & $module Get-TargetMachines $tmNames $cred $auth $configuration

Assert-AreEqual $tmNames.Count $tms.Count

Assert-AreEqual $tms[0].computerName 'machine1'
Assert-AreEqual $tms[0].WSManPort '5985'

Assert-AreEqual $tms[1].computerName 'machine2'
Assert-AreEqual $tms[1].WSManPort '123'

Assert-AreEqual $tms[2].computerName '2.2.2.2'
Assert-AreEqual $tms[2].WSManPort '5985'

Assert-AreEqual $tms[3].computerName '3.3.3.3'
Assert-AreEqual $tms[3].WSManPort '5987'