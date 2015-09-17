Param(
    [string][Parameter(Mandatory = $true)]
    $Path,
    [string][Parameter(Mandatory = $true)]
    $AssemblyVersion,
    [string][Parameter(Mandatory = $true)]
    $AssemblyFileVersion,
    [string][Parameter(Mandatory = $true)]
    $AssemblyInformationalVersion
)
 
function Update-AssemblyInfo
{
    Param(
        [string]$assemblyVersion,
        [string]$assemblyFileVersion,
        [string]$assemblyInformationalVersion
    )

    $assemblyVersionPattern = 'AssemblyVersion\("[0-9]+(\.([0-9]+|\*)){1,3}"\)'
    $assemblyfileVersionPattern = 'AssemblyFileVersion\("[0-9]+(\.([0-9]+|\*)){1,3}"\)'
    $assemblyInformationalVersionPattern = 'AssemblyInformationalVersion\("[0-9]+(\.([0-9]+|\*)){1,3}"\)'

    $assemblyVersionReplacement = 'AssemblyVersion("' + $assemblyVersion + '")'
    $assemblyFileVersionReplacement = 'AssemblyFileVersion("' + $assemblyFileVersion + '")'
    $assemblyInformationalVersionReplacement = 'AssemblyInformationalVersion("' + $assemblyInformationalVersion + '")'
 

    foreach($assemblyFile in $input) {
        $fileName = $assemblyFile.FullName
        Write-Host "Patching AssemblyInfo in $fileName"

        (Get-Content $fileName) | ForEach-Object  { 
           % {$_ -replace $assemblyVersionPattern, $assemblyVersionReplacement } |
           % {$_ -replace $assemblyfileVersionPattern, $assemblyFileVersionReplacement } |
           % {$_ -replace $assemblyInformationalVersionPattern, $assemblyInformationalVersionReplacement }
        } | Out-File $fileName -Encoding UTF8 -Force
    }
}

function Update-AllAssemblyInfoFiles
{
   Param (
        [string]$assemblyVersion,
        [string]$assemblyFileVersion,
        [string]$assemblyInformationalVersion,
        [string]$path
   )

   Write-Host "Searching $path for AssemblyInfo files"
   Get-Childitem "$($env:BUILD_REPOSITORY_LOCALPATH)$path" -Recurse | Update-AssemblyInfo $assemblyVersion $assemblyFileVersion $assemblyInformationalVersion
}

Write-Verbose "Entering script $($MyInvocation.MyCommand.Name)"

Write-Verbose "Parameter values:"
foreach($key in $PSBoundParameters.Keys) {
    Write-Verbose ($key + ' = ' + $PSBoundParameters[$key])
}

Update-AllAssemblyInfoFiles $AssemblyVersion $AssemblyFileVersion $AssemblyInformationalVersion $Path

Write-Verbose "Leaving script $($MyInvocation.MyCommand.Name)"