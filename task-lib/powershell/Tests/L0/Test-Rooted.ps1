[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = (Get-Module VstsTaskSdk)
    function Test-Rooted {
        [CmdletBinding()]
        param(
            [Parameter(Mandatory = $true)]
            [string]$Path,
            [Parameter(Mandatory = $true)]
            [bool]$Expected)

        Assert-AreEqual -Expected $Expected -Actual (& $vstsModule Test-Rooted -Path $Path) -Message "Expected Test-Rooted for input <$Path> to yield <$Expected>"
    }

    # Drive root
    Test-Rooted -Path 'C:/' -Expected $true
    Test-Rooted -Path 'a:/hello' -Expected $true
    Test-Rooted -Path 'c:/hello' -Expected $true
    Test-Rooted -Path 'z:/hello' -Expected $true
    Test-Rooted -Path 'A:/hello' -Expected $true
    Test-Rooted -Path 'C:/hello' -Expected $true
    Test-Rooted -Path 'Z:/hello' -Expected $true
    Test-Rooted -Path 'C:\\' -Expected $true
    Test-Rooted -Path 'C:\\hello' -Expected $true

    # Relative drive root
    Test-Rooted -Path 'C:' -Expected $true
    Test-Rooted -Path 'C:hello' -Expected $true
    Test-Rooted -Path 'C:hello/world' -Expected $true
    Test-Rooted -Path 'C:hello\\world' -Expected $true

    # Current drive root
    Test-Rooted -Path '/' -Expected $true
    Test-Rooted -Path '/hello' -Expected $true
    Test-Rooted -Path '/hello/world' -Expected $true
    Test-Rooted -Path '\\' -Expected $true
    Test-Rooted -Path '\\hello' -Expected $true
    Test-Rooted -Path '\\hello\\world' -Expected $true

    # UNC
    Test-Rooted -Path '//machine/share' -Expected $true
    Test-Rooted -Path '//machine/share/' -Expected $true
    Test-Rooted -Path '//machine/share/hello' -Expected $true
    Test-Rooted -Path '\\\\machine\\share' -Expected $true
    Test-Rooted -Path '\\\\machine\\share\\' -Expected $true
    Test-Rooted -Path '\\\\machine\\share\\hello' -Expected $true

    # Relative
    Test-Rooted -Path 'hello' -Expected $false
    Test-Rooted -Path 'hello/world' -Expected $false
    Test-Rooted -Path 'hello\\world' -Expected $false
}