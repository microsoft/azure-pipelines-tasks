[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = (Get-Module VstsTaskSdk)
    function Assert-RootedPattern {
        [CmdletBinding()]
        param(
            [Parameter(Mandatory = $true)]
            [string]$DefaultRoot,
            [Parameter(Mandatory = $true)]
            [string]$Pattern,
            [Parameter(Mandatory = $true)]
            [string]$Expected)

        Assert-AreEqual -Expected $Expected -Actual (& $vstsModule Get-RootedPattern -DefaultRoot $DefaultRoot -Pattern $Pattern) -Message "Expected Get-RootedPattern for input <$DefaultRoot, $Pattern> to yield <$Expected>"
    }

    # Already rooted - drive root
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'C:/' -Expected 'C:/'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'a:/hello' -Expected 'a:/hello'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'C:\' -Expected 'C:\'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'C:\hello' -Expected 'C:\hello'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'C:\hello\world' -Expected 'C:\hello\world'

    # Already rooted - relative drive root
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'C:' -Expected 'C:'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'C:hello' -Expected 'C:hello'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'C:hello/world' -Expected 'C:hello/world'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'C:hello\world' -Expected 'C:hello\world'

    # Already rooted - current drive root
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern '/' -Expected '/'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern '/hello' -Expected '/hello'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern '\' -Expected '\'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern '\hello' -Expected '\hello'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern '\hello\world' -Expected '\hello\world'

    # Already rooted - UNC
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern '//machine/share' -Expected '//machine/share'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern '\\machine\share' -Expected '\\machine\share'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern '\\\machine\\machine\' -Expected '\\\machine\\machine\'

    # Not already rooted
    Assert-RootedPattern -DefaultRoot 'D:' -Pattern 'hello' -Expected 'D:hello'
    Assert-RootedPattern -DefaultRoot 'D:/' -Pattern 'hello' -Expected 'D:\hello'
    Assert-RootedPattern -DefaultRoot 'D:/' -Pattern 'hello/world' -Expected 'D:\hello/world'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'hello' -Expected 'D:\hello'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'hello\world' -Expected 'D:\hello\world'
    Assert-RootedPattern -DefaultRoot 'D:/root' -Pattern 'hello' -Expected 'D:\root\hello'
    Assert-RootedPattern -DefaultRoot 'D:/root' -Pattern 'hello/world' -Expected 'D:\root\hello/world'
    Assert-RootedPattern -DefaultRoot 'D:\root' -Pattern 'hello' -Expected 'D:\root\hello'
    Assert-RootedPattern -DefaultRoot 'D:\root' -Pattern 'hello\world' -Expected 'D:\root\hello\world'
    Assert-RootedPattern -DefaultRoot 'D:/root/' -Pattern 'hello' -Expected 'D:\root\hello'
    Assert-RootedPattern -DefaultRoot 'D:/root/' -Pattern 'hello/world' -Expected 'D:\root\hello/world'
    Assert-RootedPattern -DefaultRoot 'D:\root\' -Pattern 'hello' -Expected 'D:\root\hello'
    Assert-RootedPattern -DefaultRoot 'D:\root\' -Pattern 'hello\world' -Expected 'D:\root\hello\world'
    Assert-RootedPattern -DefaultRoot 'D:\' -Pattern 'hello\\world\' -Expected 'D:\hello\\world\'
    Assert-RootedPattern -DefaultRoot 'D:/' -Pattern 'hello///world//' -Expected 'D:\hello///world//'
    Assert-RootedPattern -DefaultRoot 'D:' -Pattern 'hello///world//' -Expected 'D:hello///world//'
    Assert-RootedPattern -DefaultRoot 'D:\abc' -Pattern 'hello///world//' -Expected 'D:\abc\hello///world//'
    Assert-RootedPattern -DefaultRoot 'D:\abc\' -Pattern 'hello///world//' -Expected 'D:\abc\hello///world//'
    Assert-RootedPattern -DefaultRoot 'D:\abc\\' -Pattern 'hello///world//' -Expected 'D:\abc\hello///world//'
    Assert-RootedPattern -DefaultRoot 'D:/abc' -Pattern 'hello///world//' -Expected 'D:\abc\hello///world//'
    Assert-RootedPattern -DefaultRoot 'D:/abc/' -Pattern 'hello///world//' -Expected 'D:\abc\hello///world//'
    Assert-RootedPattern -DefaultRoot 'D:/abc//' -Pattern 'hello///world//' -Expected 'D:\abc\hello///world//'
    Assert-RootedPattern -DefaultRoot '\\machine\share' -Pattern 'hello///world//' -Expected '\\machine\share\hello///world//'
    Assert-RootedPattern -DefaultRoot '\\\machine\share' -Pattern 'hello///world//' -Expected '\\machine\share\hello///world//'
    Assert-RootedPattern -DefaultRoot '\\machine\share\\' -Pattern 'hello///world//' -Expected '\\machine\share\hello///world//'
    Assert-RootedPattern -DefaultRoot '//machine/share' -Pattern 'hello///world//' -Expected '\\machine\share\hello///world//'
    Assert-RootedPattern -DefaultRoot '///machine/share' -Pattern 'hello///world//' -Expected '\\machine\share\hello///world//'
    Assert-RootedPattern -DefaultRoot '///machine/share//' -Pattern 'hello///world//' -Expected '\\machine\share\hello///world//'

    # Escapes glob characters
    Assert-RootedPattern -DefaultRoot '/abc[[def]' -Pattern 'hello' -Expected '\abc[[][[]def]\hello'
    Assert-RootedPattern -DefaultRoot '/ab??c' -Pattern 'hello' -Expected '\ab[?][?]c\hello'
    Assert-RootedPattern -DefaultRoot '/ab**c' -Pattern 'hello' -Expected '\ab[*][*]c\hello'
    Assert-RootedPattern -DefaultRoot '/ab+(+(c' -Pattern 'hello' -Expected '\ab[+]([+](c\hello'
    Assert-RootedPattern -DefaultRoot '/ab@(@(c' -Pattern 'hello' -Expected '\ab[@]([@](c\hello'
    Assert-RootedPattern -DefaultRoot '/ab!(!(c' -Pattern 'hello' -Expected '\ab[!]([!](c\hello'
    Assert-RootedPattern -DefaultRoot '/abc[?*+(@(!(def]' -Pattern 'hello' -Expected '\abc[[][?][*][+]([@]([!](def]\hello'
}