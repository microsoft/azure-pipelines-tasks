[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = (Get-Module VstsTaskSdk)
    Add-Type -LiteralPath "$([System.IO.Path]::GetDirectoryName($vstsModule.Path))\Minimatch.dll"

    function Assert-FindInfoFromPattern {
        [CmdletBinding()]
        param(
            [Parameter(Mandatory = $true)]
            [string]$DefaultRoot,
            [Parameter(Mandatory = $true)]
            [string]$Pattern,
            [Parameter(Mandatory = $true)]
            $MatchOptions,
            [Parameter(Mandatory = $true)]
            $Expected)

        Write-Host "Testing <$DefaultRoot, $Pattern, $(ConvertTo-Json -InputObject $MatchOptions)"
        $actual = & $vstsModule Get-FindInfoFromPattern -DefaultRoot $DefaultRoot -Pattern $Pattern -MatchOptions $MatchOptions
        Assert-AreEqual -Expected $Expected.AdjustedPattern -Actual $actual.AdjustedPattern -Message 'AdjustedPattern does not match'
        Assert-AreEqual -Expected $Expected.FindPath -Actual $actual.FindPath -Message 'FindPath does not match'
        Assert-AreEqual -Expected $Expected.StatOnly -Actual $actual.StatOnly -Message 'StatOnly does not match'
    }

    # Basename
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern 'hello' -MatchOptions (New-VstsMatchOptions -NoBrace) -Expected @{
            AdjustedPattern = '\default-root\hello'
            FindPath = '\default-root\hello'
            StatOnly = $true
        }

    # Relative path
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern 'hello/world' -MatchOptions (New-VstsMatchOptions -NoBrace) -Expected @{
            AdjustedPattern = '\default-root\hello/world'
            FindPath = '\default-root\hello\world'
            StatOnly = $true
        }

    # Relative path, glob
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern 'hello/world*' -MatchOptions (New-VstsMatchOptions -NoBrace) -Expected @{
            AdjustedPattern = '\default-root\hello/world*'
            FindPath = '\default-root\hello'
            StatOnly = $false
        }

    # Rooted path
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern '/non-default-root/hello/world' -MatchOptions (New-VstsMatchOptions -NoBrace) -Expected @{
            AdjustedPattern = '/non-default-root/hello/world'
            FindPath = '\non-default-root\hello\world'
            StatOnly = $true
        }

    # Rooted path, glob
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern '/non-default-root/hello/world*' -MatchOptions (New-VstsMatchOptions -NoBrace) -Expected @{
            AdjustedPattern = '/non-default-root/hello/world*'
            FindPath = '\non-default-root\hello'
            StatOnly = $false
        }

    # Rooted path, glob, nocase: true
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern '/non-default-root/hello/world*' -MatchOptions (New-VstsMatchOptions -Nobrace -NoCase) -Expected @{
            AdjustedPattern = '/non-default-root/hello/world*'
            FindPath = '\non-default-root\hello'
            StatOnly = $false
        }

    # UNC path, glob
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern '//machine/share/hello/world*' -MatchOptions (New-VstsMatchOptions -NoBrace) -Expected @{
            AdjustedPattern = '//machine/share/hello/world*'
            FindPath = '\\machine\share\hello'
            StatOnly = $false
        }

    # Backslashes
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern '\hello\world*' -MatchOptions (New-VstsMatchOptions -NoBrace) -Expected @{
            AdjustedPattern = '\hello\world*'
            FindPath = '\hello'
            StatOnly = $false
        }

    # MatchBase: true, basename
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern 'hello' -MatchOptions (New-VstsMatchOptions -MatchBase -NoBrace) -Expected @{
            AdjustedPattern = 'hello'
            FindPath = '/default-root'
            StatOnly = $false
        }

    # MatchBase: true, relative path
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern 'hello/world' -MatchOptions (New-VstsMatchOptions -MatchBase -Nobrace) -Expected @{
            AdjustedPattern = '\default-root\hello/world'
            FindPath = '\default-root\hello\world'
            StatOnly = $true
        }

    # MatchBase: true, relative path, contains glob
    Assert-FindInfoFromPattern -DefaultRoot '/default-root' -Pattern 'hello/world*' -MatchOptions (New-VstsMatchOptions -MatchBase -Nobrace) -Expected @{
            AdjustedPattern = '\default-root\hello/world*'
            FindPath = '\default-root\hello'
            StatOnly = $false
        }
}