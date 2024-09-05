[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = (Get-Module VstsTaskSdk)
    function Assert-NormalizedSeparators {
        [CmdletBinding()]
        param(
            [Parameter(Mandatory = $true)]
            [string]$Path,
            [Parameter(Mandatory = $true)]
            [string]$Expected)

        Assert-AreEqual -Expected $Expected -Actual (& $vstsModule ConvertTo-NormalizedSeparators -Path $Path) -Message "Expected ConvertTo-NormalizedSeparators for input <$Path> to yield <$Expected>"
    }

    # Drive-rooted
    Assert-NormalizedSeparators -Path 'C:/' -Expected 'C:\'
    Assert-NormalizedSeparators -Path 'C:/hello' -Expected 'C:\hello'
    Assert-NormalizedSeparators -Path 'C:\' -Expected 'C:\'
    Assert-NormalizedSeparators -Path 'C:\hello' -Expected 'C:\hello'
    Assert-NormalizedSeparators -Path 'C:' -Expected 'C:'
    Assert-NormalizedSeparators -Path 'C:hello' -Expected 'C:hello'
    Assert-NormalizedSeparators -Path 'C:hello/world' -Expected 'C:hello\world'
    Assert-NormalizedSeparators -Path 'C:hello\world' -Expected 'C:hello\world'
    Assert-NormalizedSeparators -Path '/' -Expected '\'
    Assert-NormalizedSeparators -Path '/hello' -Expected '\hello'
    Assert-NormalizedSeparators -Path '/hello/world' -Expected '\hello\world'
    Assert-NormalizedSeparators -Path '/hello//world' -Expected '\hello\world'
    Assert-NormalizedSeparators -Path '\' -Expected '\'
    Assert-NormalizedSeparators -Path '\hello' -Expected '\hello'
    Assert-NormalizedSeparators -Path '\hello\' -Expected '\hello\'
    Assert-NormalizedSeparators -Path '\hello\world' -Expected '\hello\world'
    Assert-NormalizedSeparators -Path '\hello\\world' -Expected '\hello\world'

    # UNC
    Assert-NormalizedSeparators -Path '//machine/share' -Expected '\\machine\share'
    Assert-NormalizedSeparators -Path '//machine/share/' -Expected '\\machine\share\'
    Assert-NormalizedSeparators -Path '//machine/share/hello' -Expected '\\machine\share\hello'
    Assert-NormalizedSeparators -Path '///machine/share' -Expected '\\machine\share'
    Assert-NormalizedSeparators -Path '\\machine\share' -Expected '\\machine\share'
    Assert-NormalizedSeparators -Path '\\machine\share\' -Expected '\\machine\share\'
    Assert-NormalizedSeparators -Path '\\machine\share\hello' -Expected '\\machine\share\hello'
    Assert-NormalizedSeparators -Path '\\\machine\share' -Expected '\\machine\share'

    # Relative
    Assert-NormalizedSeparators -Path 'hello' -Expected 'hello'
    Assert-NormalizedSeparators -Path 'hello/world' -Expected 'hello\world'
    Assert-NormalizedSeparators -Path 'hello//world' -Expected 'hello\world'
    Assert-NormalizedSeparators -Path 'hello\\world' -Expected 'hello\world'
    Assert-NormalizedSeparators -Path 'hello\\\\world' -Expected 'hello\world'
}