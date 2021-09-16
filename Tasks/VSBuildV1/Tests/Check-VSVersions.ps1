[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Get-VSPath.ps1

$instance = New-Object  Object
Add-Member -NotePropertyName installationPath -NotePropertyValue 'use_vswhere' -inputObject $instance

$GVSVersions = @('17', '16', '15')

foreach ($GSVersion in $GVSVersions) {
    Register-Mock Get-VisualStudio { $instance } -- $GSVersion
}

$VSVersionsUseRegister = @('14.0', '12.0', '11.0', '10.0')

foreach ($VSVersion in $VSVersionsUseRegister) {
    Register-Mock Get-ItemProperty { @{ShellFolder = 'use_register'} } -- -LiteralPath HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\$VSVersion -Name ShellFolder -ErrorAction Ignore

}

$VSVersionsUseVswhere = @('17.0', '16.0', '15.0')

# Assert.

foreach ($VSVersion in $VSVersionsUseVswhere ) {
    $path = Get-VSPath $VSVersion
    Assert-AreEqual 'use_vswhere' $path
}

foreach ($VSVersion in $VSVersionsUseRegister) {
    $path = Get-VSPath $VSVersion
    Assert-AreEqual 'use_register' $path
}

