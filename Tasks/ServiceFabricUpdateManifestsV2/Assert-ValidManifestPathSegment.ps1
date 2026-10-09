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
        throw (Get-VstsLocString -Key InvalidManifestPathSegment -ArgumentList @($ElementDescription, $Name))
    }
}
