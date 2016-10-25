$script:resourceStrings = @{ }

<#
.SYNOPSIS
Gets a localized resource string.

.DESCRIPTION
Gets a localized resource string and optionally formats the string with arguments.

If the format fails (due to a bad format string or incorrect expected arguments in the format string), then the format string is returned followed by each of the arguments (delimited by a space).

If the lookup key is not found, then the lookup key is returned followed by each of the arguments (delimited by a space).

.PARAMETER Require
Writes an error to the error pipeline if the endpoint is not found.
#>
function Get-LocString {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, Position = 1)]
        [string]$Key,
        [Parameter(Position = 2)]
        [object[]]$ArgumentList = @( ))

    # Due to the dynamically typed nature of PowerShell, a single null argument passed
    # to an array parameter is interpreted as a null array.
    if ([object]::ReferenceEquals($null, $ArgumentList)) {
        $ArgumentList = @( $null )
    }

    # Lookup the format string.
    $format = ''
    if (!($format = $script:resourceStrings[$Key])) {
        # Warn the key was not found. Prevent recursion if the lookup key is the
        # "string resource key not found" lookup key.
        $resourceNotFoundKey = 'PSLIB_StringResourceKeyNotFound0'
        if ($key -ne $resourceNotFoundKey) {
            Write-Warning (Get-LocString -Key $resourceNotFoundKey -ArgumentList $Key)
        }

        # Fallback to just the key itself if there aren't any arguments to format.
        if (!$ArgumentList.Count) { return $key }

        # Otherwise fallback to the key followed by the arguments.
        $OFS = " "
        return "$key $ArgumentList"
    }

    # Return the string if there aren't any arguments to format.
    if (!$ArgumentList.Count) { return $format }

    try {
        [string]::Format($format, $ArgumentList)
    } catch {
        Write-Warning (Get-LocString -Key 'PSLIB_StringFormatFailed')
        $OFS = " "
        "$format $ArgumentList"
    }
}

<#
.SYNOPSIS
Imports resource strings for use with Get-VstsLocString.

.DESCRIPTION
Imports resource strings for use with Get-VstsLocString. The imported strings are stored in an internal resource string dictionary. Optionally, if a separate resource file for the current culture exists, then the localized strings from that file then imported (overlaid) into the same internal resource string dictionary.

Resource strings from the SDK are prefixed with "PSLIB_". This prefix should be avoided for custom resource strings.

.Parameter LiteralPath
JSON file containing resource strings.

.EXAMPLE
Import-VstsLocStrings -LiteralPath $PSScriptRoot\Task.json

Imports strings from messages section in the JSON file. If a messages section is not defined, then no strings are imported. Example messages section:
{
    "messages": {
        "Hello": "Hello you!",
        "Hello0": "Hello {0}!"
    }
}

.EXAMPLE
Import-VstsLocStrings -LiteralPath $PSScriptRoot\Task.json

Overlays strings from an optional separate resource file for the current culture.

Given the task variable System.Culture is set to 'de-DE'. This variable is set by the agent based on the current culture for the job.
Given the file Task.json contains:
{
    "messages": {
        "GoodDay": "Good day!",
    }
}
Given the file resources.resjson\de-DE\resources.resjson:
{
    "loc.messages.GoodDay": "Guten Tag!"
}

The net result from the import command would be one new key-value pair added to the internal dictionary: Key = 'GoodDay', Value = 'Guten Tag!'
#>
function Import-LocStrings {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$LiteralPath)

    # Validate the file exists.
    if (!(Test-Path -LiteralPath $LiteralPath -PathType Leaf)) {
        Write-Warning (Get-LocString -Key PSLIB_FileNotFound0 -ArgumentList $LiteralPath)
        return
    }

    # Load the json.
    Write-Verbose "Loading resource strings from: $LiteralPath"
    $count = 0
    if ($messages = (Get-Content -LiteralPath $LiteralPath -Encoding UTF8 | Out-String | ConvertFrom-Json).messages) {
        # Add each resource string to the hashtable.
        foreach ($member in (Get-Member -InputObject $messages -MemberType NoteProperty)) {
            [string]$key = $member.Name
            $script:resourceStrings[$key] = $messages."$key"
            $count++
        }
    }

    Write-Verbose "Loaded $count strings."

    # Get the culture.
    $culture = Get-TaskVariable -Name "System.Culture" -Default "en-US"

    # Load the resjson.
    $resjsonPath = "$([System.IO.Path]::GetDirectoryName($LiteralPath))\Strings\resources.resjson\$culture\resources.resjson"
    if (Test-Path -LiteralPath $resjsonPath) {
        Write-Verbose "Loading resource strings from: $resjsonPath"
        $count = 0
        $resjson = Get-Content -LiteralPath $resjsonPath -Encoding UTF8 | Out-String | ConvertFrom-Json
        foreach ($member in (Get-Member -Name loc.messages.* -InputObject $resjson -MemberType NoteProperty)) {
            if (!($value = $resjson."$($member.Name)")) {
                continue
            }

            [string]$key = $member.Name.Substring('loc.messages.'.Length)
            $script:resourceStrings[$key] = $value
            $count++
        }

        Write-Verbose "Loaded $count strings."
    }
}
