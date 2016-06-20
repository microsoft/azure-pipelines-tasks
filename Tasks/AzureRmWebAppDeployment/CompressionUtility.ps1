. $PSScriptRoot/Utility.ps1

function UnzipWebDeployPkg
{
    Param(
        [String][Parameter(mandatory=$true)]
        $PackagePath
    )

    $7ZipExePath =  "$PSScriptRoot\7zip\7z.exe"
    $TempUnzippedPath = New-Item -ItemType Directory -Path (Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName()))

    Write-Verbose "Unzipping Web Deploy Package $PackagePath to $TempUnzippedPath"

    $UnzipCommand = "`"$7ZipExePath`" x $PackageFile -o$TempUnzippedPath -y" 
    Run-Command -command $UnzipCommand

    Write-Verbose "Unzipped Web Deploy Package $PackagePath to $TempUnzippedPath"
    return $TempUnzippedPath
}

function CreateWebDeployPkg
{
    Param(
        [String][Parameter(mandatory=$true)]
        $UnzippedPkgPath,
        [String][Parameter(mandatory=$true)]
        $FinalPackagePath
    )

    $7ZipExePath =  "$PSScriptRoot\7zip\7z.exe"
    $TempPkgPath = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())

    Write-Verbose "Zipping Web Deploy Package Folder $UnzippedPkgPath to $TempPkgPath"

    $ZipCommand = "`"$7ZipExePath`" a -tzip $TempPkgPath $UnzippedPkgPath\* -y" 
    Run-Command -command $ZipCommand

    Write-Verbose "Zipped Web Deploy Package Folder $UnzippedPkgPath to $TempPkgPath"

    Write-Verbose "Deleting temporary folder and package: $UnzippedPkgPath, $TempPkgPath"
    Move-Item -Path $TempPkgPath -Destination $FinalPackagePath
    Remove-Item -Path $UnzippedPkgPath -Force
}