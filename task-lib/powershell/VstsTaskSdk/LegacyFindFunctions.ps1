<#
.SYNOPSIS
Finds files or directories.

.DESCRIPTION
Finds files or directories using advanced pattern matching.

.PARAMETER LiteralDirectory
Directory to search.

.PARAMETER LegacyPattern
Proprietary pattern format. The LiteralDirectory parameter is used to root any unrooted patterns.

Separate multiple patterns using ";". Escape actual ";" in the path by using ";;".
"?" indicates a wildcard that represents any single character within a path segment.
"*" indicates a wildcard that represents zero or more characters within a path segment.
"**" as the entire path segment indicates a recursive search.
"**" within a path segment indicates a recursive intersegment wildcard.
"+:" (can be omitted) indicates an include pattern.
"-:" indicates an exclude pattern.

The result is from the command is a union of all the matches from the include patterns, minus the matches from the exclude patterns.

.PARAMETER IncludeFiles
Indicates whether to include files in the results.

If neither IncludeFiles or IncludeDirectories is set, then IncludeFiles is assumed.

.PARAMETER IncludeDirectories
Indicates whether to include directories in the results.

If neither IncludeFiles or IncludeDirectories is set, then IncludeFiles is assumed.

.PARAMETER Force
Indicates whether to include hidden items.

.EXAMPLE
Find-VstsFiles -LegacyPattern "C:\Directory\Is?Match.txt"

Given:
C:\Directory\Is1Match.txt
C:\Directory\Is2Match.txt
C:\Directory\IsNotMatch.txt

Returns:
C:\Directory\Is1Match.txt
C:\Directory\Is2Match.txt

.EXAMPLE
Find-VstsFiles -LegacyPattern "C:\Directory\Is*Match.txt"

Given:
C:\Directory\IsOneMatch.txt
C:\Directory\IsTwoMatch.txt
C:\Directory\NonMatch.txt

Returns:
C:\Directory\IsOneMatch.txt
C:\Directory\IsTwoMatch.txt

.EXAMPLE
Find-VstsFiles -LegacyPattern "C:\Directory\**\Match.txt"

Given:
C:\Directory\Match.txt
C:\Directory\NotAMatch.txt
C:\Directory\SubDir\Match.txt
C:\Directory\SubDir\SubSubDir\Match.txt

Returns:
C:\Directory\Match.txt
C:\Directory\SubDir\Match.txt
C:\Directory\SubDir\SubSubDir\Match.txt

.EXAMPLE
Find-VstsFiles -LegacyPattern "C:\Directory\**"

Given:
C:\Directory\One.txt
C:\Directory\SubDir\Two.txt
C:\Directory\SubDir\SubSubDir\Three.txt

Returns:
C:\Directory\One.txt
C:\Directory\SubDir\Two.txt
C:\Directory\SubDir\SubSubDir\Three.txt

.EXAMPLE
Find-VstsFiles -LegacyPattern "C:\Directory\Sub**Match.txt"

Given:
C:\Directory\IsNotAMatch.txt
C:\Directory\SubDir\IsAMatch.txt
C:\Directory\SubDir\IsNot.txt
C:\Directory\SubDir\SubSubDir\IsAMatch.txt
C:\Directory\SubDir\SubSubDir\IsNot.txt

Returns:
C:\Directory\SubDir\IsAMatch.txt
C:\Directory\SubDir\SubSubDir\IsAMatch.txt
#>
function Find-Files {
    [CmdletBinding()]
    param(
        [ValidateNotNullOrEmpty()]
        [Parameter()]
        [string]$LiteralDirectory,
        [Parameter(Mandatory = $true)]
        [string]$LegacyPattern,
        [switch]$IncludeFiles,
        [switch]$IncludeDirectories,
        [switch]$Force)

    # Note, due to subtle implementation details of Get-PathPrefix/Get-PathIterator,
    # this function does not appear to be able to search the root of a drive and other
    # cases where Path.GetDirectoryName() returns empty. More details in Get-PathPrefix.

    Trace-EnteringInvocation $MyInvocation
    if (!$IncludeFiles -and !$IncludeDirectories) {
        $IncludeFiles = $true
    }

    $includePatterns = New-Object System.Collections.Generic.List[string]
    $excludePatterns = New-Object System.Collections.Generic.List[System.Text.RegularExpressions.Regex]
    $LegacyPattern = $LegacyPattern.Replace(';;', "`0")
    foreach ($pattern in $LegacyPattern.Split(';', [System.StringSplitOptions]::RemoveEmptyEntries)) {
        $pattern = $pattern.Replace("`0", ';')
        $isIncludePattern = Test-IsIncludePattern -Pattern ([ref]$pattern)
        if ($LiteralDirectory -and !([System.IO.Path]::IsPathRooted($pattern))) {
            # Use the root directory provided to make the pattern a rooted path.
            $pattern = [System.IO.Path]::Combine($LiteralDirectory, $pattern)
        }

        # Validate pattern does not end with a \.
        if ($pattern.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
            throw (Get-LocString -Key PSLIB_InvalidPattern0 -ArgumentList $pattern)
        }

        if ($isIncludePattern) {
            $includePatterns.Add($pattern)
        } else {
            $excludePatterns.Add((Convert-PatternToRegex -Pattern $pattern))
        }
    }

    $count = 0
    foreach ($path in (Get-MatchingItems -IncludePatterns $includePatterns -ExcludePatterns $excludePatterns -IncludeFiles:$IncludeFiles -IncludeDirectories:$IncludeDirectories -Force:$Force)) {
        $count++
        $path
    }

    Write-Verbose "Total found: $count"
    Trace-LeavingInvocation $MyInvocation
}

########################################
# Private functions.
########################################
function Convert-PatternToRegex {
    [CmdletBinding()]
    param([string]$Pattern)

    $Pattern = [regex]::Escape($Pattern.Replace('\', '/')). # Normalize separators and regex escape.
        Replace('/\*\*/', '((/.+/)|(/))'). # Replace directory globstar.
        Replace('\*\*', '.*'). # Replace remaining globstars with a wildcard that can span directory separators.
        Replace('\*', '[^/]*'). # Replace asterisks with a wildcard that cannot span directory separators.
        # bug: should be '[^/]' instead of '.'
        Replace('\?', '.') # Replace single character wildcards.
    New-Object regex -ArgumentList "^$Pattern`$", ([System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Get-FileNameFilter {
    [CmdletBinding()]
    param([string]$Pattern)

    $index = $Pattern.LastIndexOf('\')
    if ($index -eq -1 -or # Pattern does not contain a backslash.
        !($Pattern = $Pattern.Substring($index + 1)) -or # Pattern ends in a backslash.
        $Pattern.Contains('**')) # Last segment contains an inter-segment wildcard.
    {
        return '*'
    }

    # bug? is this supposed to do substring?
    return $Pattern
}

function Get-MatchingItems {
    [CmdletBinding()]
    param(
        [System.Collections.Generic.List[string]]$IncludePatterns,
        [System.Collections.Generic.List[regex]]$ExcludePatterns,
        [switch]$IncludeFiles,
        [switch]$IncludeDirectories,
        [switch]$Force)

    Trace-EnteringInvocation $MyInvocation
    $allFiles = New-Object System.Collections.Generic.HashSet[string]
    foreach ($pattern in $IncludePatterns) {
        $pathPrefix = Get-PathPrefix -Pattern $pattern
        $fileNameFilter = Get-FileNameFilter -Pattern $pattern
        $patternRegex = Convert-PatternToRegex -Pattern $pattern
        # Iterate over the directories and files under the pathPrefix.
        Get-PathIterator -Path $pathPrefix -Filter $fileNameFilter -IncludeFiles:$IncludeFiles -IncludeDirectories:$IncludeDirectories -Force:$Force |
            ForEach-Object {
                # Normalize separators.
                $normalizedPath = $_.Replace('\', '/')
                # **/times/** will not match C:/fun/times because there isn't a trailing slash.
                # So try both if including directories.
                $alternatePath = "$normalizedPath/" # potential bug: it looks like this will result in a false
                                                    # positive if the item is a regular file and not a directory

                $isMatch = $false
                if ($patternRegex.IsMatch($normalizedPath) -or ($IncludeDirectories -and $patternRegex.IsMatch($alternatePath))) {
                    $isMatch = $true

                    # Test whether the path should be excluded.
                    foreach ($regex in $ExcludePatterns) {
                        if ($regex.IsMatch($normalizedPath) -or ($IncludeDirectories -and $regex.IsMatch($alternatePath))) {
                            $isMatch = $false
                            break
                        }
                    }
                }

                if ($isMatch) {
                    $null = $allFiles.Add($_)
                }
            }
    }

    Trace-Path -Path $allFiles -PassThru
    Trace-LeavingInvocation $MyInvocation
}

function Get-PathIterator {
    [CmdletBinding()]
    param(
        [string]$Path,
        [string]$Filter,
        [switch]$IncludeFiles,
        [switch]$IncludeDirectories,
        [switch]$Force)

    if (!$Path) {
        return
    }

    # bug: this returns the dir without verifying whether exists
    if ($IncludeDirectories) {
        $Path
    }

    Get-DirectoryChildItem -Path $Path -Filter $Filter -Force:$Force -Recurse |
        ForEach-Object {
            if ($_.Attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Directory)) {
                if ($IncludeDirectories) {
                    $_.FullName
                }
            } elseif ($IncludeFiles) {
                $_.FullName
            }
        }
}

function Get-PathPrefix {
    [CmdletBinding()]
    param([string]$Pattern)

    # Note, unable to search root directories is a limitation due to subtleties of this function
    # and downstream code in Get-PathIterator that short-circuits when the path prefix is empty.
    # This function uses Path.GetDirectoryName() to determine the path prefix, which will yield
    # empty in some cases. See the following examples of Path.GetDirectoryName() input => output:
    #       C:/             =>
    #       C:/hello        => C:\
    #       C:/hello/       => C:\hello
    #       C:/hello/world  => C:\hello
    #       C:/hello/world/ => C:\hello\world
    #       C:              =>
    #       C:hello         => C:
    #       C:hello/        => C:hello
    #       /               =>
    #       /hello          => \
    #       /hello/         => \hello
    #       //hello         =>
    #       //hello/        =>
    #       //hello/world   =>
    #       //hello/world/  => \\hello\world

    $index = $Pattern.IndexOfAny([char[]]@('*'[0], '?'[0]))
    if ($index -eq -1) {
        # If no wildcards are found, return the directory name portion of the path.
        # If there is no directory name (file name only in pattern), this will return empty string.
        return [System.IO.Path]::GetDirectoryName($Pattern)
    }

    [System.IO.Path]::GetDirectoryName($Pattern.Substring(0, $index))
}

function Test-IsIncludePattern {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ref]$Pattern)

    # Include patterns start with +: or anything except -:
    # Exclude patterns start with -:
    if ($Pattern.value.StartsWith("+:")) {
        # Remove the prefix.
        $Pattern.value = $Pattern.value.Substring(2)
        $true
    } elseif ($Pattern.value.StartsWith("-:")) {
        # Remove the prefix.
        $Pattern.value = $Pattern.value.Substring(2)
        $false
    } else {
        # No prefix, so leave the string alone.
        $true;
    }
}
