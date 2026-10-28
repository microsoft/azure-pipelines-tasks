. "$PSScriptRoot\ps_modules\ExternalOutputSanitizer\ExternalOutputSanitizer.ps1"

function Assert-ValidManifestPathSegment
{
    param(
        [string] $Name,
        [string] $ElementDescription
    )

    if ([string]::IsNullOrWhiteSpace($Name) -or
        $Name -eq '.' -or
        $Name -eq '..' -or
        $Name.IndexOfAny([char[]]@('\', '/')) -ne -1 -or
        $Name.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ne -1 -or
        [System.IO.Path]::IsPathRooted($Name) -or
        $Name.TrimEnd('.', ' ') -ne $Name)
    {
        # $Name reaches the host only through the task SDK's own Write-Warning/exception reporting,
        # which escapes just the literal characters ';','\r','\n',']'. Sanitize it here, 
        # at the one place the invalid value is captured, same as every other untrusted value this task logs.
        throw (Get-VstsLocString -Key InvalidManifestPathSegment -ArgumentList @($ElementDescription, (Protect-ExternalOutput -InputObject $Name -Source 'repository')))
    }
}
